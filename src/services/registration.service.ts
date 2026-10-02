import type { PendingRegistration, RegistrationStatus, SystemUser } from '../types';
import { can } from '../auth/permissions';
import { getSnapshot, setState } from './db';
import { apiOr } from './http';
import { isValidEmail, sleep, uid } from '../lib/format';
import { sendMail } from './mailer';
import { auditService } from './auth.service';

/**
 * Public registration + Super Admin approval.
 *
 * Transport mirrors the auth service: in API mode the Express backend is
 * authoritative (`POST /api/auth/register` is public — no bearer needed;
 * review endpoints are `registrations.review`-gated) and the workspace store
 * is dual-written so React keeps rendering. Offline, the identical rules run
 * against the local `pendingRegistrations` slice.
 */

export const MAX_REG_FILE_BYTES = 2 * 1024 * 1024;

export interface RegistrationInput {
  company: string;
  county: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  contactPhone: string;
  certOfIncorporation: string;
  kraPinCert?: string;
  termsAccepted: boolean;
}

/** Display name for a registration — prefers the two-panel first/last name, falls back to legacy `contactName`. */
export function registrationContactName(r: Pick<PendingRegistration, 'firstName' | 'lastName'> & { contactName?: string }): string {
  const full = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim().replace(/\s+/g, ' ');
  return full || r.contactName?.trim() || '—';
}

/** Decoded byte size of a base64 dataURL (or raw base64). -1 when unparseable. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const clean = b64.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/=]*$/.test(clean) || clean.length === 0) return -1;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

/** Username rule: email local-part + 4 random uppercase alphanumerics. */
export function buildUsername(email: string): string {
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  for (const n of buf) suffix += alphabet[n % alphabet.length];
  return `${local}${suffix}`;
}

export function validateRegistration(input: RegistrationInput): string | null {
  if (!input.company.trim()) return 'Company or organisation name is required.';
  if (!input.county.trim()) return 'County is required.';
  if (!input.firstName.trim()) return 'First name is required.';
  if (!input.lastName.trim()) return 'Last name is required.';
  if (!isValidEmail(input.contactEmail.trim())) return 'Enter a valid contact email address.';
  if (!input.contactPhone.trim()) return 'Contact phone number is required.';
  if (!input.certOfIncorporation) return 'Attach your certificate of incorporation.';
  for (const [label, file] of [
    ['Certificate of incorporation', input.certOfIncorporation],
    ['Corporate Tax Certificate', input.kraPinCert],
  ] as const) {
    if (!file) continue;
    const size = dataUrlBytes(file);
    if (size < 0) return `${label}: that file could not be read — re-attach it.`;
    if (size > MAX_REG_FILE_BYTES) return `${label} exceeds the 2 MB limit — attach a smaller file.`;
  }
  if (!input.termsAccepted) return 'Accept the Terms of Service and Data Protection consent to continue.';
  return null;
}

export const registrationService = {
  async submit(input: RegistrationInput): Promise<{ ok: boolean; pendingId?: string; message?: string }> {
    const err = validateRegistration(input);
    if (err) return { ok: false, message: err };

    const local = async () => {
      await sleep(380);
      const email = input.contactEmail.trim().toLowerCase();
      const s = getSnapshot();
      if (s.users.some((u) => u.email.toLowerCase() === email)) {
        return { ok: false, message: 'An account with that email already exists — sign in instead.' };
      }
      if (s.pendingRegistrations.some((r) => r.contactEmail.toLowerCase() === email && r.status === 'pending')) {
        return { ok: false, message: 'A registration for that email is already awaiting review.' };
      }
      const at = new Date().toISOString();
      const reg: PendingRegistration = {
        id: uid('reg'),
        company: input.company.trim(),
        county: input.county.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        contactName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
        contactEmail: email,
        contactPhone: input.contactPhone.trim(),
        certOfIncorporation: input.certOfIncorporation,
        kraPinCert: input.kraPinCert || undefined,
        termsAcceptedAt: at,
        status: 'pending',
        createdAt: at,
      };
      setState((prev) => ({ pendingRegistrations: [reg, ...prev.pendingRegistrations] }));
      auditService.append({
        actorId: 'public', actorName: registrationContactName(reg), actorTier: 'user',
        action: 'registration.submitted', entity: 'PendingRegistration', entityId: reg.id,
        severity: 'info', ip: '0.0.0.0',
        detail: `${reg.company} <${reg.contactEmail}> requested a workspace`,
      });
      // Notify the Super Admin reviewer through the dev outbox (LOCAL mirror of
      // the server's `fleek-iprs-pending-registration` dispatch).
      const reviewer = s.users.find((u) => u.tier === 'super_admin');
      if (reviewer) {
        await sendMail({
          to: reviewer.email,
          subject: `Fleek IPRS — new registration pending review (${reg.company})`,
          template: 'fleek-iprs-pending-registration',
          vars: { company: reg.company, contactEmail: reg.contactEmail, certStatus: 'pending verification' },
        });
      }
      return { ok: true, pendingId: reg.id };
    };

    const payload = {
      company: input.company.trim(),
      county: input.county.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      contactEmail: input.contactEmail.trim(),
      contactPhone: input.contactPhone.trim(),
      certOfIncorporation: input.certOfIncorporation,
      kraPinCert: input.kraPinCert,
      termsAccepted: input.termsAccepted,
    };
    return apiOr<{ ok: boolean; pendingId?: string; message?: string }>(
      '/api/auth/register', { method: 'POST', body: payload }, local, { syncLocal: false }
    ).then((r) => {
      // Dual-write the public submission into the local mirror so the review
      // queue renders even when the session later drops to LOCAL.
      if (r.via === 'api' && r.data.ok && r.data.pendingId) {
        const at = new Date().toISOString();
        setState((prev) => {
          if (prev.pendingRegistrations.some((x) => x.id === r.data.pendingId)) return {};
          return {
            pendingRegistrations: [
              {
                id: r.data.pendingId as string,
                company: input.company.trim(),
                county: input.county.trim(),
                firstName: input.firstName.trim(),
                lastName: input.lastName.trim(),
                contactName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
                contactEmail: input.contactEmail.trim().toLowerCase(),
                contactPhone: input.contactPhone.trim(),
                certOfIncorporation: input.certOfIncorporation,
                kraPinCert: input.kraPinCert || undefined,
                termsAcceptedAt: at,
                status: 'pending' as const,
                createdAt: at,
              },
              ...prev.pendingRegistrations,
            ],
          };
        });
      }
      return r.data;
    });
  },

  list(status?: RegistrationStatus): PendingRegistration[] {
    const all = getSnapshot().pendingRegistrations;
    return status ? all.filter((r) => r.status === status) : all;
  },

  async refresh(actor: SystemUser | null): Promise<PendingRegistration[]> {
    if (!actor || !can(actor, 'registrations.review')) return this.list();
    try {
      const { data } = await apiOr<PendingRegistration[]>('/api/registrations', undefined, async () => this.list());
      setState({ pendingRegistrations: data });
      return data;
    } catch {
      return this.list();
    }
  },

  async approve(actor: SystemUser | null, id: string): Promise<{ ok: boolean; username?: string; tempPassword?: string; message?: string }> {
    const local = async () => {
      await sleep(380);
      if (!actor) return { ok: false, message: 'Not authenticated.' };
      if (!can(actor, 'registrations.review')) return { ok: false, message: 'Only a Super Admin can approve registrations.' };
      const reg = getSnapshot().pendingRegistrations.find((r) => r.id === id);
      if (!reg) return { ok: false, message: 'Registration request not found.' };
      if (reg.status !== 'pending') return { ok: false, message: `That request is already ${reg.status}.` };
      if (getSnapshot().users.some((u) => u.email.toLowerCase() === reg.contactEmail.toLowerCase())) {
        return { ok: false, message: 'An account with that email already exists.' };
      }
      const username = buildUsername(reg.contactEmail);
      const tempPassword = `Fleek-${uid('t').slice(-6)}!${Math.floor(100 + Math.random() * 900)}`;
      const walletId = `w-${uid('u')}`;
      const user: SystemUser = {
        id: uid('u'),
        name: registrationContactName(reg),
        email: reg.contactEmail,
        username,
        password: tempPassword,
        phone: reg.contactPhone,
        department: reg.company,
        jobTitle: 'Workspace Owner',
        tier: 'user',
        status: 'Active',
        isSystem: false,
        mfaEnabled: false,
        createdAt: new Date().toISOString(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        walletId,
      };
      const at = new Date().toISOString();
      setState((prev) => ({
        users: [...prev.users, user],
        wallets: [
          ...prev.wallets,
          {
            id: walletId, userId: user.id, currency: 'KES', balance: 0, held: 0,
            lifetimeTopUp: 0, lifetimeSpend: 0, autoTopUp: false,
            autoTopUpTriggerKes: prev.settings.billing.lowBalanceAlertKes, autoTopUpAmountKes: 10000,
            lowBalanceAlertKes: prev.settings.billing.lowBalanceAlertKes,
            overdraftAllowed: prev.settings.billing.overdraftAllowed, updatedAt: at,
          },
        ],
        pendingRegistrations: prev.pendingRegistrations.map((r) =>
          r.id === id ? { ...r, status: 'approved' as const, decidedAt: at, decidedBy: actor.name, createdUserId: user.id } : r
        ),
      }));
      auditService.append({
        actorId: actor.id, actorName: actor.name, actorTier: actor.tier,
        action: 'registration.approved', entity: 'PendingRegistration', entityId: id,
        severity: 'critical', ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: `Approved ${reg.company} — account ${username} <${reg.contactEmail}> created`,
      });
      await sendMail({
        to: reg.contactEmail,
        subject: 'Welcome to Fleek IPRS — your account is approved',
        template: 'fleek-iprs-registration-approved',
        vars: { name: registrationContactName(reg), company: reg.company, username, tempPassword },
      });
      return { ok: true, username, tempPassword };
    };
    return apiOr('/api/admin/approve-registration/' + id, { method: 'POST' }, local, { syncLocal: true }).then((r) => r.data);
  },

  async reject(actor: SystemUser | null, id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    const local = async () => {
      await sleep(300);
      if (!actor) return { ok: false, message: 'Not authenticated.' };
      if (!can(actor, 'registrations.review')) return { ok: false, message: 'Only a Super Admin can reject registrations.' };
      if (!reason.trim()) return { ok: false, message: 'Give a reason — the applicant sees it.' };
      const reg = getSnapshot().pendingRegistrations.find((r) => r.id === id);
      if (!reg) return { ok: false, message: 'Registration request not found.' };
      if (reg.status !== 'pending') return { ok: false, message: `That request is already ${reg.status}.` };
      const at = new Date().toISOString();
      setState((prev) => ({
        pendingRegistrations: prev.pendingRegistrations.map((r) =>
          r.id === id ? { ...r, status: 'rejected' as const, decidedAt: at, decidedBy: actor.name, rejectionReason: reason.trim() } : r
        ),
      }));
      auditService.append({
        actorId: actor.id, actorName: actor.name, actorTier: actor.tier,
        action: 'registration.rejected', entity: 'PendingRegistration', entityId: id,
        severity: 'warning', ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: `Rejected ${reg.company} <${reg.contactEmail}> — ${reason.trim()}`,
      });
      // Notify the applicant (best-effort — never fails the rejection). Reuses
      // the existing `fleek-iprs-pending-registration` template with the
      // rejected-outcome body variant; no 6th template is introduced.
      await sendMail({
        to: reg.contactEmail,
        subject: 'Your Fleek IPRS application — outcome',
        template: 'fleek-iprs-pending-registration',
        vars: {
          outcome: 'rejected', name: registrationContactName(reg), company: reg.company,
          reason: reason.trim(), contactEmail: reg.contactEmail,
        },
      });
      return { ok: true };
    };
    return apiOr('/api/admin/reject-registration/' + id, { method: 'POST', body: { reason } }, local, { syncLocal: true }).then((r) => r.data);
  },
};
