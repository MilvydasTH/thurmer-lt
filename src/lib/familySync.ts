import { apiPost } from './api';
import type { FamilyChange, FamilyInfo, FamilyRequest, FamilyResponse, SharedRecipe } from './familyTypes';
import { imageToBase64, saveBase64Image } from './platform';
import type { GroceryItem, Recipe } from './types';
import { isUntouchedSample, useStore } from '@/store';

async function call(req: FamilyRequest): Promise<FamilyResponse | { ok: false; error: 'network' }> {
  try {
    return await apiPost<FamilyResponse>('/api/family', req, 60_000);
  } catch {
    return { ok: false, error: 'network' };
  }
}

export type FamilyError = Extract<FamilyResponse, { ok: false }>['error'] | 'network';

export async function createFamily(familyName: string, memberName: string, shareExisting: boolean): Promise<FamilyError | null> {
  const res = await call({ action: 'create', familyName, memberName });
  if (!res.ok) return res.error;
  if (!('memberId' in res)) return 'bad_request';
  useStore.getState().joinFamily(res.family, res.memberId, memberName.trim(), shareExisting);
  return null;
}

export async function joinFamily(code: string, memberName: string, shareExisting: boolean): Promise<FamilyError | null> {
  const res = await call({ action: 'join', code, memberName });
  if (!res.ok) return res.error;
  if (!('memberId' in res)) return 'bad_request';
  useStore.getState().joinFamily(res.family, res.memberId, memberName.trim(), shareExisting);
  return null;
}

export async function leaveFamily(): Promise<void> {
  const f = useStore.getState().family;
  if (f) await call({ action: 'leave', code: f.code, memberId: f.memberId });
  useStore.getState().leaveFamily();
}

/** What goes to the family: the recipe without the parts that are personal to this phone. */
async function outgoing(r: Recipe): Promise<FamilyChange> {
  const { favorite: _favorite, cookbookIds: _cookbookIds, addedBy: _addedBy, ...shared } = r;
  const recipe: SharedRecipe = shared;
  // Photos at a web address or bundled with the app travel as a reference; photos that live on
  // this phone have to be sent themselves, because their location means nothing to anyone else.
  const local = !!r.image && !/^(https?:|sample:|food:)/.test(r.image);
  if (!local) return { id: r.id, updatedAt: r.updatedAt, recipe };
  const imageData = await imageToBase64(r.image!);
  return { id: r.id, updatedAt: r.updatedAt, recipe: { ...recipe, image: undefined }, imageData };
}

let running: Promise<FamilySyncResult> | null = null;

export type FamilySyncResult = 'ok' | 'none' | 'offline' | 'removed';

/**
 * Sends this phone's changes to the family and collects everyone else's. Safe to call often:
 * calls made while one is running share its result.
 */
export function syncFamily(): Promise<FamilySyncResult> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<FamilySyncResult> {
  for (let round = 0; round < 60; round++) {
    const s = useStore.getState();
    const f = s.family;
    if (!f) return 'none';

    const deletes = [...s.tombstones, ...s.cartGone].slice(0, 30);
    const items = s.cartDirty
      .map((id) => s.groceries.find((g) => g.id === id))
      .filter((g): g is GroceryItem => !!g)
      .slice(0, 25);
    const toSend = s.dirty
      .map((id) => s.recipes.find((r) => r.id === id))
      .filter((r): r is Recipe => !!r && !isUntouchedSample(r))
      .slice(0, 3);
    const push: FamilyChange[] = [
      ...deletes.map((d) => ({ id: d.id, updatedAt: d.at, deleted: true })),
      ...items.map((g) => ({ id: g.id, updatedAt: g.updatedAt ?? g.createdAt, item: g })),
      ...(await Promise.all(toSend.map(outgoing))),
    ];

    const res = await call({ action: 'sync', code: f.code, memberId: f.memberId, cursor: f.cursor, push });
    if (!res.ok) {
      if (res.error === 'not_found' || res.error === 'not_member') {
        useStore.getState().leaveFamily();
        return 'removed';
      }
      return 'offline';
    }
    if (!('changes' in res)) return 'offline';

    const changes = res.changes.map((c) => {
      if (!c.imageData || c.deleted) return c;
      try {
        return { ...c, image: saveBase64Image(`family-${c.id}-${c.updatedAt}`, c.imageData), imageData: undefined };
      } catch {
        return { ...c, imageData: undefined };
      }
    });
    const family: FamilyInfo = res.family;
    useStore.getState().applyFamilySync({
      sent: toSend.map((r) => ({ id: r.id, updatedAt: r.updatedAt })),
      sentDeletes: deletes.map((d) => d.id),
      sentItems: items.map((g) => ({ id: g.id, updatedAt: g.updatedAt ?? g.createdAt })),
      changes,
      cursor: res.cursor,
      family,
    });

    const after = useStore.getState();
    // Untouched starter recipes never go out; drop them from the queue so it can empty.
    const waiting = after.dirty.filter((id) => {
      const r = after.recipes.find((x) => x.id === id);
      return !!r && !isUntouchedSample(r);
    });
    const cartWaiting = after.cartDirty.filter((id) => after.groceries.some((g) => g.id === id));
    if (!res.more && waiting.length === 0 && cartWaiting.length === 0 && after.tombstones.length === 0 && after.cartGone.length === 0) return 'ok';
  }
  return 'ok';
}
