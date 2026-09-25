import { describe, expect, it } from 'vitest';
import { effectivePermissions } from '../../src/auth/permissions';
import { estimateCost } from '../../src/data/pricing';
import { KES, maskMsisdn, normalizeMsisdn } from '../../src/lib/format';
import type { SystemUser } from '../../src/types';
import { hashPassword, verifyPassword } from '../../server/passwords.mjs';

const createUser = (overrides: Partial<SystemUser> = {}): SystemUser => ({
  id: 'test-user',
  name: 'Test User',
  email: 'test@example.com',
  password: 'test-password',
  phone: '0712345678',
  department: 'Operations',
  jobTitle: 'Tester',
  tier: 'user',
  subRole: 'analyst',
  status: 'Active',
  isSystem: false,
  mfaEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  failedLoginAttempts: 0,
  permissionOverrides: {},
  ...overrides,
});

describe('permission tiers', () => {
  it('gives super_admin every permission', () => {
    const user = createUser({ id: 's', tier: 'super_admin', subRole: 'analyst', permissionOverrides: {} });
    expect(effectivePermissions(user).has('pricing.edit')).toBe(true);
    expect(effectivePermissions(user).has('maintenance.toggle')).toBe(true);
  });

  it('does not give admin pricing.edit', () => {
    const user = createUser({ id: 'a', tier: 'admin', permissionOverrides: {} });
    expect(effectivePermissions(user).has('pricing.edit')).toBe(false);
  });

  it('keeps viewer users from running searches', () => {
    const user = createUser({ id: 'v', tier: 'user', subRole: 'viewer', permissionOverrides: {} });
    expect(effectivePermissions(user).has('search.run')).toBe(false);
  });

  it('implies search.view.own from search.view.all', () => {
    const user = createUser({ id: 'all-search', tier: 'admin', permissionOverrides: {} });
    expect(effectivePermissions(user).has('search.view.all')).toBe(true);
    expect(effectivePermissions(user).has('search.view.own')).toBe(true);
  });

  it('implies case.view.own from case.view.all', () => {
    const user = createUser({ id: 'all-case', tier: 'admin', permissionOverrides: {} });
    expect(effectivePermissions(user).has('case.view.all')).toBe(true);
    expect(effectivePermissions(user).has('case.view.own')).toBe(true);
  });

  it('implies wallet.view.own from wallet.view.all', () => {
    const user = createUser({ id: 'all-wallet', tier: 'admin', permissionOverrides: {} });
    expect(effectivePermissions(user).has('wallet.view.all')).toBe(true);
    expect(effectivePermissions(user).has('wallet.view.own')).toBe(true);
  });

  it('honors an explicit removal of an implied permission', () => {
    const user = createUser({
      id: 'scoped',
      tier: 'admin',
      permissionOverrides: { 'case.view.own': false },
    });
    expect(effectivePermissions(user).has('case.view.all')).toBe(true);
    expect(effectivePermissions(user).has('case.view.own')).toBe(false);
  });

  it('does not allow overrides to reduce a super_admin', () => {
    const user = createUser({
      id: 'super',
      tier: 'super_admin',
      subRole: 'analyst',
      permissionOverrides: { 'pricing.edit': false },
    });
    expect(effectivePermissions(user).has('pricing.edit')).toBe(true);
  });
});

describe('pricing and format helpers', () => {
  it('estimates the configured catalogue basket', () => {
    const estimate = estimateCost(
      [
        { itemId: 'kyc-id', volume: 1 },
        { itemId: 'kyc-address', volume: 1 },
      ],
      { includeAccessFee: false, includeVat: false },
    );
    expect(estimate.subtotal).toBe(50);
  });

  it('sums multiple catalogue items and volumes', () => {
    const estimate = estimateCost(
      [
        { itemId: 'kyc-id', volume: 2 },
        { itemId: 'kyc-address', volume: 3 },
      ],
      { includeAccessFee: false, includeVat: false },
    );
    expect(estimate.subtotal).toBe(120);
    expect(estimate.totalChecks).toBe(5);
  });

  it('caps a selection at the catalogue batch maximum', () => {
    const estimate = estimateCost([{ itemId: 'kyc-id', volume: 999 }], {
      includeAccessFee: false,
      includeVat: false,
    });
    expect(estimate.lines[0].volume).toBe(500);
    expect(estimate.subtotal).toBe(15000);
  });

  it('ignores unknown catalogue selections', () => {
    const estimate = estimateCost([{ itemId: 'not-in-catalogue', volume: 1 }], {
      includeAccessFee: false,
      includeVat: false,
    });
    expect(estimate.lines).toHaveLength(0);
    expect(estimate.total).toBe(0);
  });

  it('returns a zero estimate for an empty basket', () => {
    const estimate = estimateCost([], { includeAccessFee: false, includeVat: false });
    expect(estimate.totalChecks).toBe(0);
    expect(estimate.effectivePerCheck).toBe(0);
  });

  it('adds the monthly access fee when enabled', () => {
    const estimate = estimateCost([{ itemId: 'kyc-id', volume: 1 }], { includeVat: false });
    expect(estimate.subtotal).toBe(15030);
    expect(estimate.monthlyAccessFee).toBe(15000);
  });

  it('normalizes Kenyan phone numbers', () => {
    expect(normalizeMsisdn('0712345678')).toBe('254712345678');
  });

  it('keeps a valid international Kenyan phone number unchanged', () => {
    expect(normalizeMsisdn('+254 712 345 678')).toBe('254712345678');
  });

  it('normalizes a compact Kenyan mobile number', () => {
    expect(normalizeMsisdn('712345678')).toBe('254712345678');
  });

  it('rejects phone numbers with unsupported lengths', () => {
    expect(normalizeMsisdn('123')).toBeNull();
    expect(normalizeMsisdn('071234567')).toBeNull();
    expect(normalizeMsisdn('')).toBeNull();
  });

  it('masks the middle of a Kenyan phone number', () => {
    expect(maskMsisdn('254712345678')).toBe('2547 *** 678');
  });

  it('formats Kenyan shillings', () => {
    expect(KES(1234)).toContain('1,234');
  });

  it('formats Kenyan shillings with decimals when requested', () => {
    expect(KES(1234.5, { decimals: true })).toContain('1,234.50');
  });
});

describe('password hashes', () => {
  it('verifies a scrypt password without accepting the plaintext', async () => {
    const hash = await hashPassword('Iprs@2026!');
    expect(await verifyPassword('Iprs@2026!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('rejects malformed scrypt hashes', async () => {
    expect(await verifyPassword('Iprs@2026!', 'plaintext')).toBe(false);
    expect(await verifyPassword('Iprs@2026!', 's1$missing-hash')).toBe(false);
    expect(await verifyPassword('Iprs@2026!', 's2$salt$hash')).toBe(false);
  });

  it('rejects a hash whose digest has been altered', async () => {
    const hash = await hashPassword('Iprs@2026!');
    const alteredHash = `${hash.slice(0, -1)}${hash.endsWith('0') ? '1' : '0'}`;
    expect(await verifyPassword('Iprs@2026!', alteredHash)).toBe(false);
  });

  it('rejects empty password verification input', async () => {
    const hash = await hashPassword('Iprs@2026!');
    expect(await verifyPassword('', hash)).toBe(false);
    expect(await verifyPassword('Iprs@2026!', '')).toBe(false);
  });
});
