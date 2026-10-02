/**
 * Fleek IPRS mailer — pluggable Resend adapter with a dev outbox.
 *
 * Two modes, exactly like the Daraja gateway (`server/daraja.mjs`):
 *
 *   - **Dev** (no `RESEND_API_KEY`): the email is written to the `email_outbox`
 *     table, logged to the console, and reported `{ ok: true }`. No network.
 *   - **Prod** (`RESEND_API_KEY` set): the same outbox row is written first,
 *     then dispatched through the Resend API (`https://api.resend.com/emails`)
 *     server-side only — the key never reaches the browser. A live dispatch
 *     failure is an honest `{ ok: false }` (Daraja-style), never fabricated
 *     success; the outbox row keeps `status: 'failed'` with the error.
 *
 * Server-internal flows (registration approval in Task 4, sub-user
 * invite/billing in Task 5) call `sendMailInternal()` directly — they never go
 * through the HTTP relay. `POST /api/email/send` stays super_admin-gated for
 * ad-hoc sends only.
 */

import crypto from 'node:crypto';
import { outboxPut } from './db.mjs';

export const MAIL_TEMPLATES = [
  'fleek-iprs-registration-approved',
  'fleek-iprs-pending-registration',
  'fleek-iprs-sub-user-invite',
  'fleek-iprs-sub-user-billing',
  'fleek-iprs-sub-user-suspended',
];

export function isLive() {
  return !!process.env.RESEND_API_KEY;
}

export function describe() {
  return {
    mode: isLive() ? 'resend' : 'dev-outbox',
    from: process.env.RESEND_FROM ?? 'Fleek IPRS <noreply@fleek-iprs.co.ke>',
    configured: isLive(),
  };
}

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const shell = (title, heading, greeting, lines, cta) => `
<!doctype html><html><body style="margin:0;background:#0b1220;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="border:1px solid #1e293b;border-radius:12px;overflow:hidden">
<div style="background:#0ea5e9;padding:20px 24px;color:#04121f">
<div style="font-size:20px;font-weight:bold">Fleek IPRS</div>
<div style="font-size:12px;opacity:.8">${esc(title)}</div>
</div>
<div style="background:#0f172a;padding:24px">
<h1 style="font-size:18px;margin:0 0 12px">${esc(heading)}</h1>
<p style="font-size:14px;line-height:1.6">Hi ${esc(greeting)},</p>
${lines.map((l) => `<p style="font-size:14px;line-height:1.6">${l}</p>`).join('')}
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.href)}" style="background:#0ea5e9;color:#04121f;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">${esc(cta.label)}</a></p>` : ''}
<p style="font-size:12px;color:#64748b;margin-top:24px">Fleek IPRS · Identity verification for Kenya · This is an automated message, please do not reply.</p>
</div>
</div>
</div>
</body></html>`.trim();

/**
 * Render a branded template. Returns `{ subject, html, text }`.
 * Unknown template ids throw — the caller turns that into a 400.
 */
export function renderTemplate(template, vars = {}) {
  const v = (k, fallback = '') => vars[k] ?? fallback;
  switch (template) {
    case 'fleek-iprs-registration-approved': {
      const name = v('name', 'there');
      const username = v('username', '');
      const tempPassword = v('tempPassword', '');
      return {
        subject: 'Welcome to Fleek IPRS — your account is approved',
        html: shell(
          'Registration approved',
          'Your Fleek IPRS account is ready',
          name,
          [
            `Your organisation registration for <strong>${esc(v('company', 'your organisation'))}</strong> has been approved.`,
            `Sign in with username <strong>${esc(username)}</strong> and the temporary password <strong>${esc(tempPassword)}</strong>. You will be asked to change it on first sign-in.`,
          ],
          { label: 'Sign in to Fleek IPRS', href: v('loginUrl', 'https://fleek-iprs.co.ke/#/login') },
        ),
        text: `Hi ${name},\n\nYour Fleek IPRS registration for ${v('company', 'your organisation')} is approved.\nUsername: ${username}\nTemporary password: ${tempPassword}\nSign in: ${v('loginUrl', 'https://fleek-iprs.co.ke/#/login')}\n\n— Fleek IPRS`,
      };
    }
    case 'fleek-iprs-pending-registration': {
      const company = v('company', 'A new organisation');
      return {
        subject: `Fleek IPRS — new registration pending review (${company})`,
        html: shell(
          'Review required',
          'A new registration needs your review',
          'Super Admin',
          [
            `<strong>${esc(company)}</strong> (${esc(v('contactEmail', 'no contact email'))}) requested a Fleek IPRS account and is waiting for approval.`,
            `Certification: ${esc(v('certStatus', 'pending verification'))}. Open Pending Approvals to approve or reject.`,
          ],
          { label: 'Open Pending Approvals', href: v('reviewUrl', 'https://fleek-iprs.co.ke/#/pending-approvals') },
        ),
        text: `Hi Super Admin,\n\n${company} (${v('contactEmail', 'no contact email')}) requested a Fleek IPRS account and is waiting for approval.\nReview: ${v('reviewUrl', 'https://fleek-iprs.co.ke/#/pending-approvals')}\n\n— Fleek IPRS`,
      };
    }
    case 'fleek-iprs-sub-user-invite': {
      const name = v('name', 'there');
      return {
        subject: `You have been invited to ${v('hostCompany', 'a Fleek IPRS workspace')}`,
        html: shell(
          'Team invitation',
          'You have been added to a Fleek IPRS workspace',
          name,
          [
            `<strong>${esc(v('hostName', 'Your administrator'))}</strong> invited you to join <strong>${esc(v('hostCompany', 'their Fleek IPRS workspace'))}</strong> as a sub-user.`,
            `Sign in with username <strong>${esc(v('username', ''))}</strong> and the temporary password <strong>${esc(v('tempPassword', ''))}</strong>. Searches are billed to the shared host wallet.`,
          ],
          { label: 'Sign in to Fleek IPRS', href: v('loginUrl', 'https://fleek-iprs.co.ke/#/login') },
        ),
        text: `Hi ${name},\n\n${v('hostName', 'Your administrator')} invited you to join ${v('hostCompany', 'their Fleek IPRS workspace')}.\nUsername: ${v('username', '')}\nTemporary password: ${v('tempPassword', '')}\n\n— Fleek IPRS`,
      };
    }
    case 'fleek-iprs-sub-user-billing': {
      return {
        subject: `Fleek IPRS — sub-user billing: KES ${v('amountKes', 0)} charged`,
        html: shell(
          'Billing receipt',
          'Sub-user billing charged to your wallet',
          v('hostName', 'there'),
          [
            `KES <strong>${esc(v('amountKes', 0))}</strong> was charged to your wallet for <strong>${esc(v('billableCount', 0))}</strong> billable sub-user(s) (${esc(v('period', 'this month'))}).`,
            `Sub-users beyond the ${esc(v('freeIncluded', 5))} free seats cost KES ${esc(v('pricePerSeatKes', 500))} each per month.`,
          ],
          null,
        ),
        text: `Hi ${v('hostName', 'there')},\n\nKES ${v('amountKes', 0)} was charged for ${v('billableCount', 0)} billable sub-user(s) (${v('period', 'this month')}).\n\n— Fleek IPRS`,
      };
    }
    case 'fleek-iprs-sub-user-suspended': {
      return {
        subject: 'Fleek IPRS — sub-user access suspended (insufficient wallet balance)',
        html: shell(
          'Access suspended',
          'Your sub-users were suspended',
          v('hostName', 'there'),
          [
            `All sub-users under your workspace were <strong>suspended</strong> because the host wallet could not cover the KES <strong>${esc(v('amountKes', 0))}</strong> monthly sub-user charge.`,
            `Top up your wallet to restore their access automatically.`,
          ],
          { label: 'Top up wallet', href: v('topupUrl', 'https://fleek-iprs.co.ke/#/wallet') },
        ),
        text: `Hi ${v('hostName', 'there')},\n\nYour sub-users were suspended: the wallet could not cover KES ${v('amountKes', 0)} in monthly sub-user charges. Top up to restore access.\n\n— Fleek IPRS`,
      };
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

const uid = (p) => `${p}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const now = () => new Date().toISOString();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Queue (and possibly dispatch) one email. Always writes the outbox row first.
 * Resolves `{ ok, message?, outboxId? }` — never throws for provider failures.
 */
export async function sendMailInternal({ to, subject, template, vars = {} }) {
  const recipient = String(to ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(recipient)) {
    return { ok: false, message: 'Enter a valid recipient email address.' };
  }
  let rendered;
  try {
    rendered = renderTemplate(template, vars);
  } catch (e) {
    return { ok: false, message: e.message };
  }
  const id = uid('em');
  const finalSubject = String(subject ?? '').trim() || rendered.subject;

  if (!isLive()) {
    const entry = {
      id, to: recipient, subject: finalSubject, template, vars,
      channel: 'dev-outbox', status: 'sent', createdAt: now(), sentAt: now(),
      html: rendered.html, text: rendered.text,
    };
    outboxPut(entry);
    console.log(`[mailer:dev-outbox] ${template} → ${recipient} — "${finalSubject}" (id ${id})`);
    return { ok: true, message: 'Queued in the dev outbox (no RESEND_API_KEY).', outboxId: id };
  }

  // Prod: Resend, server-side only. The key never leaves this process.
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? 'Fleek IPRS <noreply@fleek-iprs.co.ke>',
        to: [recipient],
        subject: finalSubject,
        html: rendered.html,
        text: rendered.text,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message ?? `Resend ${res.status}`);
    const entry = {
      id, to: recipient, subject: finalSubject, template, vars,
      channel: 'resend', status: 'sent', createdAt: now(), sentAt: now(),
      providerId: body?.id, html: rendered.html, text: rendered.text,
    };
    outboxPut(entry);
    return { ok: true, message: 'Sent via Resend.', outboxId: id };
  } catch (e) {
    outboxPut({
      id, to: recipient, subject: finalSubject, template, vars,
      channel: 'resend', status: 'failed', error: e.message, createdAt: now(),
    });
    return { ok: false, message: `Email dispatch failed at Resend: ${e.message}`, outboxId: id };
  }
}
