export interface CallbackTokenStore {
  get(key: string): unknown;
  set(key: string, value: string): unknown;
}

export interface RequestShapeResult {
  ok: boolean;
  value?: Record<string, unknown>;
  message?: string;
}

export function securityHeaders(): Record<string, string>;
export function originAllowed(origin?: string, sameOrigin?: string | null): boolean;
export function configureCallbackStore(store: CallbackTokenStore): void;
export function callbackToken(store?: CallbackTokenStore | null, randomBytes?: (size: number) => Buffer): string;
export function assertRequestShape(body: unknown, shape: string[] | Record<string, string>): RequestShapeResult;
