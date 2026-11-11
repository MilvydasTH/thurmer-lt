/**
 * Per-visitor request limits for the server routes, which have no login. Counts are kept in
 * memory, so they reset on restart and are per server instance: enough to stop one client from
 * running up a bill, not a substitute for the host's own protection on a large deployment.
 */
const hits = new Map<string, number[]>();

function clientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

/** Returns a 429 response when this client has made more than `max` calls to `name` within `windowMs`. */
export function tooMany(request: Request, name: string, max: number, windowMs = 60_000, now = Date.now()): Response | null {
  const key = `${name}:${clientId(request)}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    const retry = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    return Response.json({ ok: false, error: 'rate_limited', reason: 'busy' }, { status: 429, headers: { 'retry-after': String(retry) } });
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the table from growing without bound on a long-running server.
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return null;
}

/** Test hook. */
export function resetRateLimits(): void {
  hits.clear();
}
