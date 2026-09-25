export interface FixedWindowRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface FixedWindowRateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export class FixedWindowRateLimiter {
  constructor(options: FixedWindowRateLimiterOptions);
  constructor(limit: number, windowMs: number, now?: () => number);
  hit(key: string): FixedWindowRateLimitResult;
  readonly size: number;
}

export interface RateLimitMiddlewareConfig extends Partial<FixedWindowRateLimiterOptions> {
  limiter?: FixedWindowRateLimiter;
  key: (req: unknown) => string;
}

export function rateLimitMiddleware(config: RateLimitMiddlewareConfig): (req: unknown, res: unknown, next: () => void) => unknown;
