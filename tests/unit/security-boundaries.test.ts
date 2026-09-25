import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertRequestShape,
  callbackToken,
  originAllowed,
  securityHeaders,
} from '../../server/security.mjs';
import { FixedWindowRateLimiter, rateLimitMiddleware } from '../../server/ratelimit.mjs';
import { stkPush } from '../../server/daraja.mjs';
import { apiOr, probeApi } from '../../src/services/http';
import { authService } from '../../src/services/auth.service';
import { getSnapshot, setState } from '../../src/services/db';

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
  vi.unstubAllGlobals();
});

describe('security helpers', () => {
  it('returns the required global security headers', () => {
    expect(securityHeaders()).toEqual({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    });
  });

  it('allows configured and same-origin browser requests but rejects other origins', () => {
    process.env.CORS_ORIGINS = 'https://console.iprs.example';
    process.env.NODE_ENV = 'production';
    expect(originAllowed('https://console.iprs.example')).toBe(true);
    expect(originAllowed('https://console.iprs.example', 'https://portal.iprs.example')).toBe(true);
    expect(originAllowed('https://attacker.example')).toBe(false);
    expect(originAllowed(undefined)).toBe(true);
  });

  it('allows the Vite development origin only in development', () => {
    process.env.NODE_ENV = 'development';
    expect(originAllowed('http://localhost:5173')).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(originAllowed('http://localhost:5173')).toBe(false);
  });

  it('rejects unknown fields and returns only the allowed request fields', () => {
    expect(assertRequestShape({ autoTopUp: true, balance: 10 }, ['autoTopUp'])).toEqual({
      ok: false,
      message: 'Unexpected request field: balance.',
    });
    expect(assertRequestShape({ autoTopUp: true, lowBalanceAlertKes: 500 }, ['autoTopUp', 'lowBalanceAlertKes'])).toEqual({
      ok: true,
      value: { autoTopUp: true, lowBalanceAlertKes: 500 },
    });
  });

  it('validates typed request shapes', () => {
    expect(assertRequestShape({ amount: '1000' }, { amount: 'number' })).toEqual({
      ok: false,
      message: 'Request field amount must be a number.',
    });
  });

  it('prefers the configured callback token', () => {
    process.env.DARAJA_CALLBACK_TOKEN = 'configured-callback-token';
    const store = { get: vi.fn(), set: vi.fn() };
    expect(callbackToken(store)).toBe('configured-callback-token');
    expect(store.get).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it('replaces a configured Daraja callback token with the active token', async () => {
    process.env.DARAJA_CONSUMER_KEY = 'daraja-key';
    process.env.DARAJA_CONSUMER_SECRET = 'daraja-secret';
    process.env.DARAJA_SHORTCODE = '400200';
    process.env.DARAJA_PASSKEY = 'passkey';
    process.env.DARAJA_CALLBACK_URL = 'https://example.test/api/wallet/topup/mpesa/callback/old-token';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'oauth-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ MerchantRequestID: 'merchant-1', CheckoutRequestID: 'checkout-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await stkPush({ msisdn: '254712345678', amount: 1000, callbackToken: 'active-callback-token' });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { CallBackURL: string };
    expect(body.CallBackURL).toBe('https://example.test/api/wallet/topup/mpesa/callback/active-callback-token');
  });

  it('generates and persists one random callback token', () => {
    delete process.env.DARAJA_CALLBACK_TOKEN;
    const values = new Map<string, string>();
    const store = {
      get: (key: string) => values.get(key) ?? null,
      set: (key: string, value: string) => values.set(key, value),
    };
    const randomBytes = vi.fn(() => Buffer.alloc(32, 7));
    const first = callbackToken(store, randomBytes);
    const second = callbackToken(store, randomBytes);
    expect(first).toBe('07'.repeat(32));
    expect(second).toBe(first);
    expect(randomBytes).toHaveBeenCalledTimes(1);
  });
});

describe('session revocation transport', () => {
  it('does not report a denied foreign/admin session revocation as local success', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const body = String(input) === '/api/health' ? { ok: true } : { ok: false, message: 'You may only revoke your own sessions.' };
      const status = String(input) === '/api/health' ? 200 : 403;
      return new Response(JSON.stringify(body), { status });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await probeApi()).toBe('api');
    const localFallback = vi.fn(async () => ({ ok: true, message: 'local success' }));

    const result = await apiOr('/api/auth/sessions/admin-session', { method: 'DELETE' }, localFallback, { fallbackOnClientError: false });

    expect(result).toEqual({ data: { ok: false, message: 'You may only revoke your own sessions.' }, via: 'api' });
    expect(localFallback).not.toHaveBeenCalled();
  });

  it('does not downgrade or locally satisfy a backend 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const path = String(input);
      return new Response(JSON.stringify(path === '/api/health' ? { ok: true } : { ok: false, message: 'Not authenticated.' }), {
        status: path === '/api/health' ? 200 : 401,
      });
    }));
    expect(await probeApi()).toBe('api');
    const localFallback = vi.fn(async () => ({ ok: true }));

    const result = await apiOr('/api/v1/verify/session', { method: 'POST', body: {} }, localFallback);

    expect(result).toEqual({ data: { ok: false, message: 'Not authenticated.' }, via: 'api' });
    expect(localFallback).not.toHaveBeenCalled();
    expect((await import('../../src/services/http')).getApiMode()).toBe('api');
  });

  it('does not let the local mirror accept fields rejected by the user update API', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const path = String(input);
      return new Response(JSON.stringify(path === '/api/health' ? { ok: true } : { ok: false, message: 'Unexpected request field: walletId.' }), {
        status: path === '/api/health' ? 200 : 400,
      });
    }));
    expect(await probeApi()).toBe('api');
    const admin = getSnapshot().users.find((user) => user.tier === 'admin');
    const target = getSnapshot().users.find((user) => user.tier === 'user');
    if (!admin || !target) throw new Error('User fixture missing.');

    const result = await authService.update(admin, target.id, { walletId: 'wal-attacker' });

    expect(result.ok).toBe(false);
    expect(getSnapshot().users.find((user) => user.id === target.id)?.walletId).toBe(target.walletId);
  });

  it('uses the privileged route for an admin revoking a foreign session', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = String(input);
      const body = path === '/api/sessions/admin-session' ? { ok: true } : { ok: false, message: 'Not authenticated.' };
      const status = path === '/api/sessions/admin-session' ? 200 : 401;
      return new Response(JSON.stringify(body), { status });
    });
    vi.stubGlobal('fetch', fetchMock);
    const admin = getSnapshot().users.find((user) => user.tier === 'admin');
    if (!admin) throw new Error('Admin fixture missing.');
    setState({ sessions: [{ id: 'admin-session', userId: 'u-analyst', userName: 'Foreign user', tier: 'user', ip: '', device: 'Foreign device', browser: 'Chrome', location: 'Nairobi', startedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), current: false }] });

    const result = await authService.revokeSession(admin, 'admin-session');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/admin-session', expect.anything());
  });
});

describe('fixed-window rate limiting', () => {
  it('allows requests through the limit and resets after the window', () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 500, now: () => now });
    expect(limiter.hit('actor')).toEqual({ allowed: true, limit: 2, remaining: 1, resetAt: 1_500 });
    expect(limiter.hit('actor')).toEqual({ allowed: true, limit: 2, remaining: 0, resetAt: 1_500 });
    expect(limiter.hit('actor')).toEqual({ allowed: false, limit: 2, remaining: 0, resetAt: 1_500 });
    now = 1_500;
    expect(limiter.hit('actor')).toEqual({ allowed: true, limit: 2, remaining: 1, resetAt: 2_000 });
  });

  it('keeps counters isolated by key and prunes expired entries', () => {
    let now = 2_000;
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 100, now: () => now });
    expect(limiter.hit('first').allowed).toBe(true);
    expect(limiter.hit('second').allowed).toBe(true);
    now = 2_100;
    expect(limiter.hit('first').allowed).toBe(true);
    expect(limiter.size).toBe(1);
  });

  it('publishes rate headers and rejects with the documented 429 body', () => {
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 1_000, now: () => 10_000 });
    const middleware = rateLimitMiddleware({ limiter, key: () => 'same-key' });
    const headers = new Map<string, string>();
    const response = {
      set: (values: Record<string, string>) => Object.entries(values).forEach(([key, value]) => headers.set(key, value)),
      status: (status: number) => ({ json: (body: unknown) => ({ status, body }) }),
      json: (body: unknown) => ({ status: 200, body }),
    };
    let nextCalls = 0;
    middleware({}, response, () => { nextCalls += 1; });
    const rejection = middleware({}, response, () => { nextCalls += 1; });
    expect(nextCalls).toBe(1);
    expect(headers.get('RateLimit-Limit')).toBe('1');
    expect(headers.get('RateLimit-Remaining')).toBe('0');
    expect(headers.get('RateLimit-Reset')).toBe('1');
    expect(headers.get('Retry-After')).toBe('1');
    expect(rejection).toEqual({ status: 429, body: { ok: false, message: 'Too many requests.' } });
  });
});
