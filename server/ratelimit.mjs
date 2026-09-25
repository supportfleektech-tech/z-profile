export class FixedWindowRateLimiter {
  constructor(options, windowMs, now = Date.now) {
    const config = typeof options === 'object' ? options : { limit: options, windowMs, now };
    this.limit = Math.max(0, Math.floor(Number(config.limit)));
    this.windowMs = Math.max(1, Math.floor(Number(config.windowMs)));
    this.now = typeof config.now === 'function' ? config.now : now;
    this.entries = new Map();
  }

  prune(now = this.now()) {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }

  hit(key) {
    const now = this.now();
    this.prune(now);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.entries.set(key, entry);
    }
    entry.count += 1;
    const allowed = entry.count <= this.limit;
    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - entry.count),
      resetAt: entry.resetAt,
    };
  }

  get size() {
    this.prune();
    return this.entries.size;
  }
}

export function rateLimitMiddleware(config) {
  const limiter = config.limiter ?? new FixedWindowRateLimiter(config);
  return (req, res, next) => {
    const key = String(config.key(req));
    const result = limiter.hit(key);
    const resetSeconds = Math.max(0, Math.ceil((result.resetAt - limiter.now()) / 1_000));
    res.set({
      'RateLimit-Limit': String(result.limit),
      'RateLimit-Remaining': String(result.remaining),
      'RateLimit-Reset': String(resetSeconds),
    });
    if (result.allowed) return next();
    const retryAfter = Math.max(1, resetSeconds);
    res.set({ 'Retry-After': String(retryAfter) });
    return res.status(429).json({ ok: false, message: 'Too many requests.' });
  };
}
