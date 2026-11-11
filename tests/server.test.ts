import { beforeEach, describe, expect, it } from 'vitest';

import { resetRateLimits, tooMany } from '../src/server/rateLimit';

const from = (ip: string) => new Request('https://app.example/api/x', { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });

describe('rate limiting', () => {
  beforeEach(resetRateLimits);

  it('allows up to the limit, then answers 429 with a retry time', async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(tooMany(from('1.1.1.1'), 'ai', 3, 60_000, t0 + i)).toBeNull();
    const blocked = tooMany(from('1.1.1.1'), 'ai', 3, 60_000, t0 + 10);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await blocked?.json()).toMatchObject({ ok: false, error: 'rate_limited' });
  });

  it('counts each visitor and each route separately', () => {
    const t0 = 2_000_000;
    expect(tooMany(from('1.1.1.1'), 'ai', 1, 60_000, t0)).toBeNull();
    expect(tooMany(from('2.2.2.2'), 'ai', 1, 60_000, t0)).toBeNull();
    expect(tooMany(from('1.1.1.1'), 'import', 1, 60_000, t0)).toBeNull();
    expect(tooMany(from('1.1.1.1'), 'ai', 1, 60_000, t0 + 1)?.status).toBe(429);
  });

  it('lets the visitor back in once the window has passed', () => {
    const t0 = 3_000_000;
    expect(tooMany(from('1.1.1.1'), 'ai', 1, 60_000, t0)).toBeNull();
    expect(tooMany(from('1.1.1.1'), 'ai', 1, 60_000, t0 + 30_000)?.status).toBe(429);
    expect(tooMany(from('1.1.1.1'), 'ai', 1, 60_000, t0 + 60_001)).toBeNull();
  });
});
