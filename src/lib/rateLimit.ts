interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup routine to prevent memory leaks
if (typeof global !== "undefined") {
  const intervalId = "rateLimitCleanupInterval";
  if (!(global as any)[intervalId]) {
    (global as any)[intervalId] = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of rateLimitMap.entries()) {
        if (now > entry.resetTime) {
          rateLimitMap.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }
}

/**
 * Checks if the request from a given IP exceeds the limit within the time window.
 * @param ip The client IP address
 * @param limit Maximum number of requests allowed in the window
 * @param windowMs Time window in milliseconds (e.g. 60000 for 1 minute)
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}
