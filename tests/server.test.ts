import { beforeEach, describe, expect, it } from 'vitest';

import { prettyCode, type FamilyChange } from '../src/lib/familyTypes';
import { handleFamily } from '../src/server/family';
import { memoryKV } from '../src/server/kv';
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

describe('family sharing', () => {
  const recipe = (id: string, title: string, updatedAt: number) => ({
    id, updatedAt,
    recipe: { id, title, servings: 2, ingredients: [], steps: ['Cook.'], tags: [], mealTypes: [], createdAt: 1, updatedAt },
  });
  const setup = async () => {
    const kv = memoryKV();
    const a = await handleFamily(kv, { action: 'create', familyName: 'Home', memberName: 'Ana' });
    if (!a.ok || !('memberId' in a)) throw new Error('create failed');
    const b = await handleFamily(kv, { action: 'join', code: a.family.code.toLowerCase(), memberName: 'Ben' });
    if (!b.ok || !('memberId' in b)) throw new Error('join failed');
    const sync = async (memberId: string, cursor: number, push: FamilyChange[] = []) => {
      const r = await handleFamily(kv, { action: 'sync', code: a.family.code, memberId, cursor, push });
      if (!r.ok || !('changes' in r)) throw new Error('sync failed');
      return r;
    };
    return { kv, code: a.family.code, ana: a.memberId, ben: b.memberId, sync };
  };

  it('creates a family with an unambiguous code and lets others join by it', async () => {
    const { code, kv } = await setup();
    expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{10}$/);
    const again = await handleFamily(kv, { action: 'join', code: prettyCode(code), memberName: 'Cy' });
    expect(again.ok && 'family' in again && again.family.members.map((m) => m.name)).toEqual(['Ana', 'Ben', 'Cy']);
    expect(await handleFamily(kv, { action: 'join', code: 'AAAAAAAAAA', memberName: 'X' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('passes a recipe from one member to another', async () => {
    const { ana, ben, sync } = await setup();
    await sync(ana, 0, [recipe('r1aaa', 'Soup', 100)]);
    const got = await sync(ben, 0);
    expect(got.changes.map((c) => [c.recipe?.title, c.by])).toEqual([['Soup', 'Ana']]);
    expect((await sync(ben, got.cursor)).changes).toEqual([]);
  });

  it('keeps the later edit and passes deletions on', async () => {
    const { ana, ben, sync } = await setup();
    await sync(ana, 0, [recipe('r1aaa', 'Soup', 100)]);
    await sync(ben, 0, [recipe('r1aaa', 'Better soup', 200)]);
    await sync(ana, 0, [recipe('r1aaa', 'Stale edit', 150)]);
    expect((await sync(ana, 0)).changes[0].recipe?.title).toBe('Better soup');
    const c = (await sync(ben, 0)).cursor;
    await sync(ana, 0, [{ id: 'r1aaa', updatedAt: 300, deleted: true }]);
    expect((await sync(ben, c)).changes).toMatchObject([{ id: 'r1aaa', deleted: true }]);
  });

  it('hands out a large library in pages', async () => {
    const { ana, ben, sync } = await setup();
    await sync(ana, 0, Array.from({ length: 20 }, (_, i) => recipe(`rec${i}aa`, `R${i}`, 100 + i)));
    const seen: string[] = [];
    let cursor = 0;
    for (let guard = 0; guard < 10; guard++) {
      const r = await sync(ben, cursor);
      seen.push(...r.changes.map((x) => x.id));
      cursor = r.cursor;
      if (!r.more) break;
    }
    expect(seen).toHaveLength(20);
    expect(new Set(seen).size).toBe(20);
  });

  it('refuses people who are not members, and members who left', async () => {
    const { kv, code, ben, sync } = await setup();
    expect(await handleFamily(kv, { action: 'sync', code, memberId: 'NOPE', cursor: 0, push: [] })).toEqual({ ok: false, error: 'not_member' });
    await handleFamily(kv, { action: 'leave', code, memberId: ben });
    await expect(sync(ben, 0)).rejects.toThrow();
  });
});

describe('shared cart', () => {
  const item = (id: string, name: string, updatedAt: number, checked = false) => ({
    id, updatedAt, item: { id, name, aisle: 'other' as const, checked, createdAt: 1, updatedAt },
  });
  it('passes cart items, ticks and removals between members', async () => {
    const kv = memoryKV();
    const a = await handleFamily(kv, { action: 'create', familyName: 'Home', memberName: 'Ana' });
    if (!a.ok || !('memberId' in a)) throw new Error('create failed');
    const b = await handleFamily(kv, { action: 'join', code: a.family.code, memberName: 'Ben' });
    if (!b.ok || !('memberId' in b)) throw new Error('join failed');
    const sync = async (memberId: string, cursor: number, push: FamilyChange[] = []) => {
      const r = await handleFamily(kv, { action: 'sync', code: a.family.code, memberId, cursor, push });
      if (!r.ok || !('changes' in r)) throw new Error('sync failed');
      return r;
    };
    await sync(a.memberId, 0, [item('milk1', '2 l milk', 100), item('eggs1', 'eggs', 101)]);
    let got = await sync(b.memberId, 0);
    expect(got.changes.map((c) => c.item?.name)).toEqual(['2 l milk', 'eggs']);
    // Ben ticks the milk in the shop; Ana sees it ticked.
    await sync(b.memberId, got.cursor, [item('milk1', '2 l milk', 200, true)]);
    got = await sync(a.memberId, 0);
    expect(got.changes.find((c) => c.id === 'milk1')?.item?.checked).toBe(true);
    // Ana clears it; Ben is told.
    const benAt = (await sync(b.memberId, 0)).cursor;
    await sync(a.memberId, got.cursor, [{ id: 'milk1', updatedAt: 300, deleted: true }]);
    expect((await sync(b.memberId, benAt)).changes).toMatchObject([{ id: 'milk1', deleted: true }]);
  });
});
