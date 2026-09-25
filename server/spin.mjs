/**
 * Spin Mobile SuperCrunch adapter (Kenya) — the live-credentials swap for searches.
 *
 * Transcribed from https://docs.spinmobile.co (Kenya section):
 *   1. POST {base}/analytics/auth/  {consumer_key, consumer_secret} → {token, expires}
 *      (token lives ~10 minutes — cached here until 60 s before expiry)
 *   2. POST {base}<module endpoint> with `Authorization: Bearer <token>` and
 *      {search_type, identifier, consent, consent_collected_by, …module extras}
 *
 * Module catalogue (search_type, endpoint, params, response shapes) lives in
 * src/data/spinModules.ts — the single source of truth shared with the UI.
 *
 * Live mode engages only when SPIN_CONSUMER_KEY and SPIN_CONSUMER_SECRET are both set
 * (SPIN_BASE_URL overrides the default). Until then the platform's modelled responses
 * run, and /api/health reports spin.mode = 'simulated'. A live-mode failure surfaces as
 * an error — never as fabricated data.
 */
import { spinModuleForItem, spinRequestBody, SPIN_MODULES } from '../src/data/spinModules.ts';

const BASE_URL = process.env.SPIN_BASE_URL ?? 'https://api.spinmobile.co';

const REQUIRED = ['SPIN_CONSUMER_KEY', 'SPIN_CONSUMER_SECRET'];

export function isLive() {
  return REQUIRED.every((k) => !!process.env[k]);
}

export function describe() {
  return {
    mode: isLive() ? 'live' : 'simulated',
    baseUrl: BASE_URL,
    missing: REQUIRED.filter((k) => !process.env[k]),
    configured: REQUIRED.filter((k) => !!process.env[k]).length,
    modules: spinModulesCount(),
  };
}

function spinModulesCount() {
  return { documented: SPIN_MODULES.length, withPublishedEndpoint: SPIN_MODULES.filter((m) => m.endpoint).length };
}

export function normalizeResponse(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, providerCode: null, message: 'Spin returned an empty response.', data: null };
  }

  if (Object.hasOwn(raw, 'code')) {
    const providerCode = raw.code ?? null;
    const numericCode = Number.parseInt(String(providerCode), 10);
    const ok = Number.isInteger(numericCode) && numericCode >= 200 && numericCode < 300;
    return {
      ok,
      providerCode,
      message: raw.message ?? (ok ? '' : 'Spin provider request failed.'),
      data: raw.data ?? null,
    };
  }

  if (Object.hasOwn(raw, 'response_code') || Object.hasOwn(raw, 'success')) {
    const providerCode = raw.response_code ?? null;
    const ok = raw.success === true && String(providerCode) === '200';
    return {
      ok,
      providerCode,
      message: raw.message ?? (ok ? '' : 'Spin provider request failed.'),
      data: raw.data ?? null,
    };
  }

  return { ok: false, providerCode: null, message: 'Spin returned an undocumented response envelope.', data: null };
}

let cachedToken = null;

/** Obtain (or reuse) an access token. Docs: valid ~10 minutes. */
export async function token() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const res = await fetch(`${BASE_URL}/analytics/auth/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      consumer_key: process.env.SPIN_CONSUMER_KEY,
      consumer_secret: process.env.SPIN_CONSUMER_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Spin auth ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const body = await res.json();
  if (!body?.token) throw new Error('Spin auth response missing token');
  // expires is epoch-seconds; fall back to the documented 10-minute lifetime.
  const expSec = Number(body.expires ?? 0);
  const ttlMs = expSec > 0 ? Math.max(30_000, expSec * 1000 - Date.now() - 60_000) : 9 * 60_000;
  cachedToken = { value: body.token, expiresAt: Date.now() + Math.min(ttlMs, 9.5 * 60_000) };
  return cachedToken.value;
}

/** Execute a module search against the live API. */
export async function search(
  moduleOrItemId,
  identifier,
  opts = {}
) {
  const module = moduleOrItemId.startsWith('spin-')
    ? SPIN_MODULES.find((m) => m.id === moduleOrItemId)
    : spinModuleForItem(moduleOrItemId) ?? SPIN_MODULES.find((m) => m.searchType === moduleOrItemId && m.pricedItemId);
  if (!module) throw new Error(`Unknown Spin module: ${moduleOrItemId}`);

  const request = spinRequestBody(module, identifier, opts);
  const path = module.endpoint ?? '/analytics/search';
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(request),
  });
  const body = await res.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new Error(`Spin ${module.searchType} ${res.status}: returned an empty response.`);
  const normalized = normalizeResponse(body);
  if (!res.ok || !normalized.ok) {
    const detail = normalized.message || normalized.providerCode || `HTTP ${res.status}`;
    throw new Error(`Spin ${module.searchType} rejected the request: ${detail}`);
  }
  return { module, request, httpStatus: res.status, body, ...normalized };
}
