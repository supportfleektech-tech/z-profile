/**
 * Safaricom Daraja (M-PESA) gateway adapter — the real-credentials swap.
 *
 * The wallet endpoints run a modelled STK simulation by default. When the four Daraja
 * credentials are present in the environment, this module takes over the dispatch step
 * and talks to the actual API:
 *
 *   DARAJA_CONSUMER_KEY / DARAJA_CONSUMER_SECRET  — OAuth credentials from the portal
 *   DARAJA_SHORTCODE / DARAJA_PASSKEY             — Paybill + Lipa na M-PESA passkey
 *   DARAJA_ENV=production                         — default is sandbox
 *   DARAJA_CALLBACK_URL                           — where Daraja posts the result
 *
 * Until every required variable is set, `isLive()` is false and the simulation runs —
 * the demo never silently half-configures a money path. Dispatch failures in live mode
 * are surfaced to the caller (502) rather than falling back to fake success: in a live
 * gateway, a fabricated success would be a lie about money.
 */
import crypto from 'node:crypto';

const REQUIRED = ['DARAJA_CONSUMER_KEY', 'DARAJA_CONSUMER_SECRET', 'DARAJA_SHORTCODE', 'DARAJA_PASSKEY'];

export function describe() {
  const present = REQUIRED.filter((k) => !!process.env[k]);
  return {
    mode: isLive() ? 'daraja' : 'simulated',
    env: process.env.DARAJA_ENV === 'production' ? 'production' : 'sandbox',
    missing: REQUIRED.filter((k) => !process.env[k]),
    configured: present.length,
  };
}

export function isLive() {
  return REQUIRED.every((k) => !!process.env[k]);
}

const baseUrl = () => (process.env.DARAJA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke');

let cachedToken = null; // { value, expiresAt }
async function oauthToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  const auth = Buffer.from(`${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`).toString('base64');
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`OAuth ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const body = await res.json();
  if (typeof body?.access_token !== 'string') throw new Error('Daraja OAuth response missing access_token');
  cachedToken = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in ?? 3599) * 1000 };
  return cachedToken.value;
}

/** Lipa na M-PESA Online (STK Push). Resolves with the Daraja checkout identifiers. */
export async function stkPush({ msisdn, amount, accountRef, description }) {
  const token = await oauthToken();
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(`${process.env.DARAJA_SHORTCODE}${process.env.DARAJA_PASSKEY}${timestamp}`).toString('base64');
  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: process.env.DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: msisdn,
      PartyB: process.env.DARAJA_SHORTCODE,
      PhoneNumber: msisdn,
      CallBackURL: process.env.DARAJA_CALLBACK_URL ?? `${process.env.PUBLIC_BASE_URL ?? ''}/api/wallet/topup/mpesa/callback`,
      AccountReference: (accountRef ?? 'IPRS Wallet').slice(0, 12),
      TransactionDesc: (description ?? 'Wallet top-up').slice(0, 13),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errorMessage) {
    throw new Error(body.errorMessage ?? `STK push ${res.status}`);
  }
  return { MerchantRequestID: body.MerchantRequestID, CheckoutRequestID: body.CheckoutRequestID, customerMessage: body.CustomerMessage };
}

/** STK status query — lets the poll endpoint ask Daraja directly in live mode. */
export async function stkQuery(checkoutRequestID) {
  const token = await oauthToken();
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(`${process.env.DARAJA_SHORTCODE}${process.env.DARAJA_PASSKEY}${timestamp}`).toString('base64');
  const res = await fetch(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ BusinessShortCode: process.env.DARAJA_SHORTCODE, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestID }),
  });
  return res.json().catch(() => ({}));
}

export const receiptJitter = () => crypto.randomInt(100000, 999999);
