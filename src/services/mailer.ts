import type { EmailOutboxEntry, EmailTemplateId, SendMailInput, SendMailResult } from '../types';
import { api, ApiError, getApiMode } from './http';
import { getSnapshot, setState, newId } from './db';

/**
 * Pluggable mailer — the frontend face of `server/mailer.mjs`.
 *
 * In API mode the call is relayed through `POST /api/email/send` (the
 * `RESEND_API_KEY` lives server-side only and is never exposed to the browser).
 * A 4xx from the relay (bad address, unknown template, non-super-admin caller)
 * is a business refusal and is returned as `{ ok: false }` — it is NOT quietly
 * rewritten as a local success. Only a truly unreachable backend (network
 * error / 5xx) falls back to the workspace `emailOutbox` slice, mirroring the
 * server's dev-outbox behaviour so Tasks 4/5 flows keep working offline.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAIL_TEMPLATES: EmailTemplateId[] = [
  'fleek-iprs-registration-approved',
  'fleek-iprs-pending-registration',
  'fleek-iprs-sub-user-invite',
  'fleek-iprs-sub-user-billing',
  'fleek-iprs-sub-user-suspended',
];

export function isTemplateId(value: string): value is EmailTemplateId {
  return (MAIL_TEMPLATES as string[]).includes(value);
}

function queueLocal(to: string, subject: string, template: EmailTemplateId, vars: SendMailInput['vars']): SendMailResult {
  const entry: EmailOutboxEntry = {
    id: newId('em'),
    to,
    subject,
    template,
    vars: vars ?? {},
    channel: 'dev-outbox',
    status: 'sent',
    createdAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
  };
  const prev = getSnapshot().emailOutbox ?? [];
  setState({ emailOutbox: [entry, ...prev].slice(0, 500) });
  // eslint-disable-next-line no-console
  console.log(`[mailer:dev-outbox] ${template} → ${to} — "${subject}" (id ${entry.id})`);
  return { ok: true, message: 'Queued in the dev outbox (LOCAL mode).', outboxId: entry.id };
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const to = input.to.trim().toLowerCase();
  if (!EMAIL_RE.test(to)) return { ok: false, message: 'Enter a valid recipient email address.' };
  if (!isTemplateId(input.template)) {
    return { ok: false, message: `Unknown email template: ${input.template}` };
  }
  const vars = input.vars ?? {};
  const subject = input.subject.trim();

  if (getApiMode() !== 'api') return queueLocal(to, subject, input.template, vars);

  try {
    return await api.post<SendMailResult>('/api/email/send', { to, subject, template: input.template, vars });
  } catch (err) {
    if (err instanceof ApiError && typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
      const payload = (err.payload ?? {}) as { message?: unknown };
      const message = typeof payload.message === 'string' ? payload.message : 'Email request refused.';
      return { ok: false, message };
    }
    // Backend unreachable — serve from the local outbox mirror, never downgrade silently.
    return queueLocal(to, subject, input.template, vars);
  }
}

export function outboxEntries(): EmailOutboxEntry[] {
  return getSnapshot().emailOutbox ?? [];
}
