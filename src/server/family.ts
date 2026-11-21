import { CODE_ALPHABET, CODE_LENGTH, normalizeCode, type FamilyChange, type FamilyInfo, type FamilyRequest, type FamilyResponse } from '@/lib/familyTypes';

import type { KV } from './kv';

const MAX_MEMBERS = 12;
const MAX_RECIPES = 3000;
const MAX_RECIPE_BYTES = 700_000;
/** A reply stops growing at this many changes or this many bytes, whichever comes first. */
const PAGE = 40;
const PAGE_BYTES = 600_000;
/** Deleted entries are remembered this long so every phone hears about the deletion. */
const TOMBSTONE_DAYS = 45;

interface Meta {
  name: string;
  createdAt: number;
  members: { id: string; name: string; joinedAt: number }[];
  /** Counts every accepted change; a phone asks for "everything after number N". */
  seq: number;
  /** `at` is the server's own clock when the change arrived; `updatedAt` is the phone's. */
  index: Record<string, { seq: number; updatedAt: number; deleted?: boolean; by?: string; at?: number }>;
}

const metaKey = (code: string) => `fam:${code}`;
const recipeKey = (code: string, id: string) => `fam:${code}:r:${id}`;

function randomString(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

const cleanName = (s: unknown): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 40) : '');

function info(code: string, meta: Meta): FamilyInfo {
  return { code, name: meta.name, members: meta.members.map((m) => ({ id: m.id, name: m.name })) };
}

async function load(kv: KV, code: string): Promise<Meta | null> {
  const raw = await kv.get(metaKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Meta;
  } catch {
    return null;
  }
}

/**
 * The whole family feature on the server: create a family, join it with its code, and exchange
 * recipe changes. The code is the key to the library — whoever has it can read and change the
 * family's recipes — so it is long, random, and never listed anywhere.
 *
 * When two people edit the same recipe, the later edit wins.
 */
export async function handleFamily(kv: KV, req: FamilyRequest, now = Date.now()): Promise<FamilyResponse> {
  if (req.action === 'create') {
    const name = cleanName(req.familyName);
    const member = cleanName(req.memberName);
    if (!name || !member) return { ok: false, error: 'bad_request' };
    let code = randomString(CODE_ALPHABET, CODE_LENGTH);
    while (await kv.get(metaKey(code))) code = randomString(CODE_ALPHABET, CODE_LENGTH);
    const memberId = randomString(CODE_ALPHABET, 12);
    const meta: Meta = { name, createdAt: now, members: [{ id: memberId, name: member, joinedAt: now }], seq: 0, index: {} };
    await kv.set(metaKey(code), JSON.stringify(meta));
    return { ok: true, family: info(code, meta), memberId };
  }

  const code = normalizeCode(typeof req.code === 'string' ? req.code : '');
  if (code.length !== CODE_LENGTH) return { ok: false, error: 'not_found' };
  const meta = await load(kv, code);
  if (!meta) return { ok: false, error: 'not_found' };

  if (req.action === 'join') {
    const member = cleanName(req.memberName);
    if (!member) return { ok: false, error: 'bad_request' };
    if (meta.members.length >= MAX_MEMBERS) return { ok: false, error: 'full' };
    const memberId = randomString(CODE_ALPHABET, 12);
    meta.members.push({ id: memberId, name: member, joinedAt: now });
    await kv.set(metaKey(code), JSON.stringify(meta));
    return { ok: true, family: info(code, meta), memberId };
  }

  const me = meta.members.find((m) => m.id === req.memberId);
  if (!me) return { ok: false, error: 'not_member' };

  if (req.action === 'leave') {
    meta.members = meta.members.filter((m) => m.id !== me.id);
    await kv.set(metaKey(code), JSON.stringify(meta));
    return { ok: true, left: true };
  }

  if (req.action !== 'sync' || !Array.isArray(req.push) || typeof req.cursor !== 'number') return { ok: false, error: 'bad_request' };

  // 1. Take in what this phone changed. An older edit never overwrites a newer one.
  let changed = false;
  for (const c of req.push.slice(0, 60)) {
    if (!c || typeof c.id !== 'string' || !/^[A-Za-z0-9_-]{4,64}$/.test(c.id) || typeof c.updatedAt !== 'number') continue;
    const known = meta.index[c.id];
    if (known && known.updatedAt >= c.updatedAt) continue;
    if (c.deleted) {
      if (!known) continue;
      await kv.del(recipeKey(code, c.id));
    } else {
      const isItem = !!c.item && typeof c.item.name === 'string';
      const isRecipe = !!c.recipe && typeof c.recipe.title === 'string' && Array.isArray(c.recipe.ingredients) && Array.isArray(c.recipe.steps);
      if (!isItem && !isRecipe) continue;
      if (!known && Object.values(meta.index).filter((v) => !v.deleted).length >= MAX_RECIPES) return { ok: false, error: 'full' };
      const body = isItem
        ? JSON.stringify({ item: { ...c.item, id: c.id, name: c.item!.name.slice(0, 200), updatedAt: c.updatedAt } })
        : JSON.stringify({ recipe: { ...c.recipe, id: c.id, updatedAt: c.updatedAt }, imageData: typeof c.imageData === 'string' ? c.imageData : undefined });
      if (body.length > MAX_RECIPE_BYTES) return { ok: false, error: 'too_large' };
      await kv.set(recipeKey(code, c.id), body);
    }
    meta.seq += 1;
    meta.index[c.id] = { seq: meta.seq, updatedAt: c.updatedAt, deleted: c.deleted ? true : undefined, by: me.name, at: now };
    changed = true;
  }
  if (changed) {
    // A shopping cart churns; forget deletions everyone has had ample time to receive.
    const cutoff = now - TOMBSTONE_DAYS * 86_400_000;
    for (const [id, v] of Object.entries(meta.index)) if (v.deleted && (v.at ?? now) < cutoff) delete meta.index[id];
    await kv.set(metaKey(code), JSON.stringify(meta));
  }

  // 2. Hand back what this phone has not seen yet, a few at a time so no reply gets huge.
  const pending = Object.entries(meta.index)
    .filter(([, v]) => v.seq > req.cursor)
    .sort((a, b) => a[1].seq - b[1].seq);
  const changes: FamilyChange[] = [];
  let bytes = 0;
  let taken = 0;
  for (const [id, v] of pending) {
    if (taken >= PAGE || bytes >= PAGE_BYTES) break;
    taken++;
    if (v.deleted) {
      changes.push({ id, updatedAt: v.updatedAt, deleted: true, by: v.by });
      continue;
    }
    const raw = await kv.get(recipeKey(code, id));
    if (!raw) continue;
    bytes += raw.length;
    try {
      const stored = JSON.parse(raw) as { recipe?: FamilyChange['recipe']; item?: FamilyChange['item']; imageData?: string };
      changes.push({ id, updatedAt: v.updatedAt, recipe: stored.recipe, item: stored.item, imageData: stored.imageData, by: v.by });
    } catch {
      /* skip a damaged record rather than fail the whole sync */
    }
  }
  const page = pending.slice(0, taken);
  const cursor = page.length > 0 ? page[page.length - 1][1].seq : Math.max(req.cursor, 0);
  return { ok: true, family: info(code, meta), cursor: Math.min(cursor, meta.seq), changes, more: pending.length > page.length };
}
