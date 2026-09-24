/**
 * Password hashing for the demo backend (scrypt, node:crypto — zero dependencies).
 *
 * Seeded accounts arrive from src/data/users.ts with the plaintext demo fixture
 * (needed by the in-browser mock adapter, which has no server to hash against).
 * At boot the server migrates every stored password to a salted scrypt hash and
 * DELETES the plaintext from the database; logins then compare via timing-safe
 * verification, and any password written later (account creation, resets) is hashed
 * on arrival. Stored format:  s1$<salthex>$<hashhex>
 *
 * Honest scope note: this protects data-at-rest in the demo database and stops the
 * API from ever handling plaintext beyond the login moment. It is not a production
 * KDF policy (cost parameters, rotation, pepper) — those come with real deployment.
 */
import crypto from 'node:crypto';

const N = 16384; // scrypt cost (2^14) — meaningful but demo-friendly latency
const KEYLEN = 64;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, KEYLEN, { N });
  return `s1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  if (!pw || !stored) return false;
  const [version, saltHex, hashHex] = String(stored).split('$');
  if (version !== 's1' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), KEYLEN, { N });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** True if the value looks like our hash format (not a plaintext legacy fixture). */
export function isHashed(stored) {
  return typeof stored === 'string' && stored.startsWith('s1$');
}
