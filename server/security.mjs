import crypto from 'node:crypto';

const CALLBACK_TOKEN_KEY = 'daraja.callbackToken';
let configuredStore = null;

export function configureCallbackStore(store) {
  configuredStore = store;
}

export function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  };
}

function normalizedOrigin(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.origin === value ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function originAllowed(origin, sameOrigin = null) {
  if (!origin) return true;
  const candidate = normalizedOrigin(origin);
  if (!candidate) return false;
  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(normalizedOrigin)
    .filter(Boolean);
  const requestOrigin = normalizedOrigin(sameOrigin);
  const publicOrigin = normalizedOrigin(process.env.PUBLIC_BASE_URL);
  if (candidate === requestOrigin || candidate === publicOrigin || configured.includes(candidate)) return true;
  return process.env.NODE_ENV === 'development' && candidate === 'http://localhost:5173';
}

export function callbackToken(store = configuredStore, randomBytes = crypto.randomBytes) {
  const configured = String(process.env.DARAJA_CALLBACK_TOKEN ?? '').trim();
  if (configured) return configured;
  if (!store) throw new Error('Callback token store is not configured.');
  const persisted = store.get(CALLBACK_TOKEN_KEY);
  if (typeof persisted === 'string' && persisted) return persisted;
  const generated = randomBytes(32).toString('hex');
  store.set(CALLBACK_TOKEN_KEY, generated);
  return generated;
}

export function assertRequestShape(body, shape) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be an object.' };
  }
  const fields = Array.isArray(shape) ? shape : Object.keys(shape);
  const unknown = Object.keys(body).find((key) => !fields.includes(key));
  if (unknown) return { ok: false, message: `Unexpected request field: ${unknown}.` };
  if (Array.isArray(shape)) {
    return { ok: true, value: Object.fromEntries(fields.filter((key) => key in body).map((key) => [key, body[key]])) };
  }
  const value = {};
  for (const [key, expected] of Object.entries(shape)) {
    if (!(key in body)) continue;
    const actual = typeof body[key];
    if (actual !== expected) return { ok: false, message: `Request field ${key} must be a ${expected}.` };
    value[key] = body[key];
  }
  return { ok: true, value };
}
