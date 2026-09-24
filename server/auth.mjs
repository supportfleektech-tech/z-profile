/**
 * Signed session tokens for the demo backend.
 *
 * The original transport trusted a raw `x-user-id` header — anyone with curl could
 * impersonate the Super Admin. This module replaces that with real bearer tokens:
 *
 *   token  := base64url(payload) "." base64url(HMAC-SHA256(secret, payload))
 *   payload := { sid, uid, exp }   (session id, user id, expiry epoch-ms)
 *
 * Properties:
 *  - **Signed** — tampered payloads fail verification (timing-safe compare).
 *  - **Bound to a live session** — the `sid` must exist in the sessions table AND be
 *    `current`; logout marks the row non-current, instantly revoking the token.
 *  - **Expiring** — 12 h by default (`IPRS_TOKEN_TTL_HOURS` to override).
 *  - **Zero dependencies** — HMAC from node:crypto; the secret lives in the SQLite
 *    kv store so tokens survive server restarts, or `IPRS_AUTH_SECRET` pins it.
 *
 * Demo caveat, stated honestly: passwords are still stored in plaintext by the seed
 * and there is no TLS story here. This is demonstration-grade auth, not production auth.
 */
import crypto from 'node:crypto';
import { kvGet, kvSet, sessions } from './db.mjs';

const TTL_HOURS = Number(process.env.IPRS_TOKEN_TTL_HOURS ?? 12);

/** The signing secret: env-pinned → kv-persisted → generated once and stored. */
function secret() {
  const fromEnv = process.env.IPRS_AUTH_SECRET;
  if (fromEnv) return fromEnv;
  const existing = kvGet('authSecret');
  if (existing) return existing;
  const generated = crypto.randomBytes(32).toString('hex');
  kvSet('authSecret', generated);
  return generated;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function sign(payloadJson) {
  return crypto.createHmac('sha256', secret()).update(payloadJson).digest('base64url');
}

/** Mint a token bound to a live session row. Returns the token and its absolute expiry. */
export function issueToken(sessionId, userId) {
  const exp = Date.now() + TTL_HOURS * 3_600_000;
  const payload = b64url(JSON.stringify({ sid: sessionId, uid: userId, exp }));
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString(), ttlHours: TTL_HOURS };
}

/**
 * Verify a bearer token. Returns `{ ok: true, sid, uid }` or `{ ok: false, reason }`
 * with one of: 'malformed' | 'bad_signature' | 'expired' | 'revoked'.
 */
export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'malformed' };
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return { ok: false, reason: 'malformed' };

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' };

  let body;
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!body?.sid || !body?.uid || typeof body.exp !== 'number') return { ok: false, reason: 'malformed' };
  if (Date.now() > body.exp) return { ok: false, reason: 'expired' };

  // The token is only as alive as its session row — logout revokes instantly.
  const session = sessions().find((s) => s.id === body.sid);
  if (!session || !session.current) return { ok: false, reason: 'revoked' };

  return { ok: true, sid: body.sid, uid: body.uid };
}

/** Extract a bearer token from the Authorization header, or null. */
export function bearerOf(req) {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}
