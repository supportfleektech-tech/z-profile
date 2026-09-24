/**
 * Transport layer with automatic fallback.
 *
 * On boot the app probes `GET /api/health`. If the Express backend (`npm run server`)
 * answers, every service call goes over REST and the header chip reads `API`. If it does
 * not, the same service signatures are served by the local store adapter and the chip
 * reads `LOCAL`. UI code never branches on this.
 */

export type ApiMode = 'api' | 'local';

let mode: ApiMode = 'local';
let probed = false;
let probePromise: Promise<ApiMode> | null = null;
const listeners = new Set<(m: ApiMode) => void>();

export function getApiMode(): ApiMode {
  return mode;
}

export function hasProbed(): boolean {
  return probed;
}

export function onApiModeChange(fn: (m: ApiMode) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setMode(next: ApiMode): void {
  if (mode === next) return;
  mode = next;
  listeners.forEach((l) => l(next));
}

export async function probeApi(timeoutMs = 1200): Promise<ApiMode> {
  if (probePromise) return probePromise;
  probePromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch('/api/health', { signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timer);
      if (res.ok) {
        const body = (await res.json()) as { ok?: boolean };
        setMode(body.ok === false ? 'local' : 'api');
      } else {
        setMode('local');
      }
    } catch {
      setMode('local');
    } finally {
      probed = true;
    }
    return mode;
  })();
  return probePromise;
}

/**
 * Identity for guarded endpoints.
 *
 * The backend resolves the acting account from `x-user-id`. http.ts deliberately does
 * NOT import the store (that would couple transport to state), so the app registers a
 * provider once at boot — see AppDataContext.
 */
let actorProvider: (() => string | null) | null = null;

export function setActorProvider(fn: () => string | null): void {
  actorProvider = fn;
}

export function currentActorId(): string | null {
  try {
    return actorProvider?.() ?? null;
  } catch {
    return null;
  }
}

/**
 * Bearer token for authenticated calls (see server/auth.mjs — signed, expiring,
 * bound to a live session). As with the actor provider, http.ts stays decoupled from
 * the store: the app registers the provider once at boot.
 */
let tokenProvider: (() => string | null) | null = null;

export function setAuthTokenProvider(fn: () => string | null): void {
  tokenProvider = fn;
}

function currentToken(): string | null {
  try {
    return tokenProvider?.() ?? null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly payload?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // Identity is proven by the signed bearer token (server/auth.mjs) — the forgeable
    // x-user-id header is retired and no longer sent.
    const token = currentToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, {
      method,
      signal: controller.signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) throw new ApiError(`Request failed: ${res.status}`, res.status, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try the backend; fall back to the local adapter so the demo never breaks when the
 * server is not running.
 *
 * Failure handling is deliberately split:
 *  - **4xx** is a *business* answer (403 "only a Super Admin may…", 409 duplicate).
 *    The local adapter enforces the identical rules and returns the same
 *    `{ok:false,message}` shapes the screens already render, so we serve the call from
 *    local WITHOUT abandoning API mode — otherwise one forbidden click would silently
 *    downgrade the whole session.
 *  - **network error / 5xx** means the backend really is unavailable, so we downgrade
 *    to LOCAL and the header chip flips.
 *
 * `syncLocal` dual-writes: the server stays authoritative for the response, while the
 * in-browser store (which is what React renders) is updated with the same mutation.
 */
export async function apiOr<T>(
  path: string,
  init: { method?: string; body?: unknown } | undefined,
  localFallback: () => Promise<T> | T,
  opts?: { syncLocal?: boolean }
): Promise<{ data: T; via: ApiMode }> {
  if (mode === 'api') {
    try {
      const data = await request<T>(init?.method ?? 'GET', path, init?.body);
      if (opts?.syncLocal) {
        // Keep the rendered store coherent with the backend. Never fatal.
        try {
          await localFallback();
        } catch {
          /* local mirror is best-effort */
        }
      }
      return { data, via: 'api' };
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      // 401 means the session is dead (no/expired/revoked token) — the API can't serve
      // this user anymore, so continue gracefully on the local adapter (chip → LOCAL).
      // 4xx otherwise are business answers served locally WITHOUT downgrading.
      if (status === 401) setMode('local');
      const business = typeof status === 'number' && status >= 400 && status < 500 && status !== 401;
      if (!business) setMode('local');
    }
  }
  const data = await localFallback();
  return { data, via: 'local' };
}

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T,>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T,>(path: string) => request<T>('DELETE', path),
};
