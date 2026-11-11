import { matchFood, mentionsFood } from '../data/foods';
import { normalizeName } from './units';

/** A store's current price for a product, taken from its weekly leaflet. */
export interface Offer {
  id: string;
  heading: string;
  description?: string;
  price: number;
  /** Normal price, when the leaflet states one. Most do not. */
  prePrice?: number;
  currency: string;
  store: string;
  storeColor?: string;
  image?: string;
  runFrom?: string;
  runTill?: string;
  /** Price per kilo, litre or piece, when the pack size is known: the only fair way to compare. */
  unitPrice?: { value: number; unit: string };
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function unitPriceOf(price: number, quantity: Json): Offer['unitPrice'] {
  const unit = obj(quantity.unit);
  const si = obj(unit.si);
  const size = num(obj(quantity.size).from);
  const pieces = num(obj(quantity.pieces).from) ?? 1;
  const factor = num(si.factor);
  const symbol = str(si.symbol) ?? str(unit.symbol);
  if (!size || !factor || !symbol || size <= 0 || pieces <= 0) return undefined;
  const amount = size * factor * pieces;
  if (amount <= 0) return undefined;
  return { value: Math.round((price / amount) * 100) / 100, unit: symbol === 'pcs' ? 'stk' : symbol };
}

/** Maps one offer from the Tjek API. Anything without a heading and a price is dropped. */
export function parseOffer(raw: unknown): Offer | undefined {
  const o = obj(raw);
  const pricing = obj(o.pricing);
  const heading = str(o.heading);
  const price = num(pricing.price);
  const id = str(o.id);
  if (!id || !heading || price === undefined) return undefined;
  const branding = obj(o.branding);
  const dealer = obj(o.dealer);
  const prePrice = num(pricing.pre_price);
  return {
    id,
    heading: heading.replace(/\s+/g, ' '),
    description: str(o.description),
    price,
    prePrice: prePrice !== undefined && prePrice > price ? prePrice : undefined,
    currency: str(pricing.currency) ?? 'DKK',
    store: str(branding.name) ?? str(dealer.name) ?? '',
    storeColor: str(branding.color),
    image: str(obj(o.images).thumb),
    runFrom: str(o.run_from),
    runTill: str(o.run_till),
    unitPrice: unitPriceOf(price, obj(o.quantity)),
  };
}

export function parseOffers(raw: unknown): Offer[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseOffer).filter((o): o is Offer => !!o && !!o.store);
}

/**
 * What to type into a Danish store search for an ingredient. Ingredients we recognise are
 * looked up under their Danish name, so an English or Lithuanian recipe still finds offers.
 */
export function offerQuery(itemName: string): string {
  const own = normalizeName(itemName);
  const food = matchFood(itemName);
  if (!food) return own;
  // Already Danish and specific ("hakket oksekød", "piskefløde"): search for exactly that.
  return own.includes(food.da) && own.split(' ').length <= 3 ? own : food.da;
}

/** Search engines return near-misses ("kefir" for "mælk"); keep only offers that are really about the item. */
export function isRelevant(offer: Offer, itemName: string, query: string): boolean {
  const heading = offer.heading.toLowerCase();
  const food = matchFood(itemName) ?? matchFood(query);
  if (food && mentionsFood(heading, food.id)) return true;
  const words = normalizeName(query).split(' ').filter((w) => w.length >= 3);
  return words.length > 0 && words.every((w) => heading.includes(w));
}

const DAY = 86_400_000;

/**
 * Offers worth showing for one item: relevant, running now or starting within a week,
 * cheapest per kilo/litre first, one per store.
 */
export function pickOffers(offers: Offer[], itemName: string, query: string, now: number, limit = 8): Offer[] {
  const live = offers.filter((o) => {
    if (!isRelevant(o, itemName, query)) return false;
    const from = o.runFrom ? Date.parse(o.runFrom) : NaN;
    const till = o.runTill ? Date.parse(o.runTill) : NaN;
    if (Number.isFinite(till) && till < now) return false;
    if (Number.isFinite(from) && from > now + 7 * DAY) return false;
    return true;
  });
  const rank = (o: Offer) => o.unitPrice?.value ?? Number.POSITIVE_INFINITY;
  live.sort((a, b) => rank(a) - rank(b) || a.price - b.price);
  const seen = new Set<string>();
  const out: Offer[] = [];
  for (const o of live) {
    if (seen.has(o.store)) continue;
    seen.add(o.store);
    out.push(o);
    if (out.length >= limit) break;
  }
  return out;
}

export function startsLater(offer: Offer, now: number): boolean {
  const from = offer.runFrom ? Date.parse(offer.runFrom) : NaN;
  return Number.isFinite(from) && from > now;
}

/** Which stores cover the most items on the list — the practical answer to "where should I shop?". */
export function storeCoverage(byItem: Record<string, Offer[]>): { store: string; items: number }[] {
  const counts = new Map<string, number>();
  for (const offers of Object.values(byItem)) {
    for (const store of new Set(offers.map((o) => o.store))) counts.set(store, (counts.get(store) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([store, items]) => ({ store, items }))
    .sort((a, b) => b.items - a.items || a.store.localeCompare(b.store));
}

export function formatPrice(value: number, currency: string): string {
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
  return currency === 'DKK' ? `${fixed} kr.` : `${fixed} ${currency}`;
}
