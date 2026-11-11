import { offerQuery, parseOffers, pickOffers, type Offer } from '@/lib/offers';

/**
 * Danish leaflet offers come from Tjek (the service behind eTilbudsavis), which covers the large
 * grocery chains. Tjek issues an API key per app; it stays on the server and is sent with each call.
 */
const ENDPOINT = 'https://squid-api.tjek.com/v2/offers/search';
const TTL = 30 * 60_000;
const MAX_ITEMS = 60;

export function offersConfigured(): boolean {
  return !!process.env.TJEK_API_KEY;
}

const cache = new Map<string, { at: number; offers: Offer[] }>();

async function search(query: string): Promise<Offer[]> {
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < TTL) return hit.offers;
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}&limit=40`, {
    headers: { accept: 'application/json', 'x-api-key': process.env.TJEK_API_KEY ?? '' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`offers ${res.status}`);
  const offers = parseOffers(await res.json());
  if (cache.size > 500) cache.clear();
  cache.set(query, { at: Date.now(), offers });
  return offers;
}

export interface OfferLookup {
  /** Offers per item key; items with nothing on offer are present with an empty list. */
  byItem: Record<string, Offer[]>;
  /** True when at least one lookup failed. */
  failed: boolean;
}

/** Looks up current offers for each item, a few at a time. */
export async function findOffers(items: { key: string; name: string }[]): Promise<OfferLookup> {
  const byItem: Record<string, Offer[]> = {};
  let failed = false;
  const queue = items.slice(0, MAX_ITEMS);
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const query = offerQuery(item.name);
      if (query.length < 2) {
        byItem[item.key] = [];
        continue;
      }
      try {
        byItem[item.key] = pickOffers(await search(query), item.name, query, Date.now());
      } catch {
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return { byItem, failed };
}
