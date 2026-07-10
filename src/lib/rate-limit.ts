// Simple in-memory rate limiter.
// Note: memory is per server instance and resets on restart/redeploy —
// that is fine for blunting bots and abuse; it is not exact accounting.

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Returns true if the action is allowed, false if the limit is exceeded.
 * @param key    unique key, e.g. `login:1.2.3.4` or `review:42`
 * @param max    max actions per window
 * @param windowMs window length in milliseconds
 * @param cost   how many units this action consumes (default 1)
 */
export function rateLimit(key: string, max: number, windowMs: number, cost = 1): boolean {
    const now = Date.now();
    // Opportunistic cleanup so the map cannot grow without bound
    if (buckets.size > 10000) {
        for (const [k, v] of buckets) {
            if (now > v.resetAt) buckets.delete(k);
        }
    }
    const b = buckets.get(key);
    if (!b || now > b.resetAt) {
        buckets.set(key, { count: cost, resetAt: now + windowMs });
        return cost <= max;
    }
    if (b.count + cost > max) return false;
    b.count += cost;
    return true;
}

export function getClientIp(request: Request): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
}
