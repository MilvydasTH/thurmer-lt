import { apiPost } from './api';
import type { Offer } from './offers';

export type OfferLookup =
  | { ok: true; byItem: Record<string, Offer[]>; failed: boolean }
  | { ok: false; error: 'not_configured' | 'network' };

/** Asks the app's server for current store offers on each item. The server holds the offers API key. */
export async function findOffers(items: { key: string; name: string }[], near?: { lat: number; lng: number }): Promise<OfferLookup> {
  try {
    const res = await apiPost<{ ok: boolean; byItem?: Record<string, Offer[]>; failed?: boolean; error?: string }>('/api/offers', { items, near }, 45_000);
    if (res.ok && res.byItem) return { ok: true, byItem: res.byItem, failed: !!res.failed };
    return { ok: false, error: res.error === 'not_configured' ? 'not_configured' : 'network' };
  } catch {
    return { ok: false, error: 'network' };
  }
}
