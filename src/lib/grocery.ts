import { aisleFor, matchFood } from '../data/foods';
import { formatQty, roundNice } from './convert';
import type { Aisle, GroceryItem, Ingredient, Lang, Recipe, UnitKey } from './types';
import { translateName } from './translateName';
import { normalizeName, parseIngredient, unitLabel } from './units';

const MASS: Partial<Record<UnitKey, number>> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
const VOLUME: Partial<Record<UnitKey, number>> = { ml: 1, cl: 10, dl: 100, l: 1000, floz: 29.57, pint: 473, quart: 946 };

/** "butter, softened" / "onion (finely chopped)" → "butter" / "onion" for a tidier shopping list. */
export function shoppingName(name: string): string {
  const cut = name.replace(/\([^)]*\)/g, ' ').split(/,|;| - /)[0].replace(/\s+/g, ' ').trim();
  return cut || name.trim();
}

export function isPantryItem(name: string, pantry: string[]): boolean {
  if (pantry.length === 0) return false;
  const n = normalizeName(name);
  const food = matchFood(name);
  return pantry.some((p) => {
    const pn = normalizeName(p);
    if (!pn) return false;
    if (n === pn || n.split(' ').includes(pn)) return true;
    const pf = matchFood(p);
    return !!food && !!pf && food.id === pf.id;
  });
}

export type NewGrocery = Omit<GroceryItem, 'id' | 'checked' | 'createdAt'>;

export function ingredientToGrocery(ing: Ingredient, scale: number, recipe?: Pick<Recipe, 'id' | 'title'>): NewGrocery {
  const name = shoppingName(ing.name);
  return {
    name,
    qty: ing.qty !== undefined ? ing.qty * scale : undefined,
    unit: ing.unit,
    aisle: aisleFor(name),
    recipeId: recipe?.id,
    recipeTitle: recipe?.title,
  };
}

export function manualGrocery(line: string): NewGrocery | undefined {
  const ing = parseIngredient(line);
  if (!ing.raw) return undefined;
  const name = ing.header ? ing.raw : shoppingName(ing.name);
  return { name, qty: ing.header ? undefined : ing.qty, unit: ing.header ? undefined : ing.unit, aisle: aisleFor(name) };
}

export interface MergedItem {
  key: string;
  name: string;
  qtyText: string;
  ids: string[];
  checked: boolean;
  aisle: Aisle;
  recipes: string[];
  /** Bought by weight or volume rather than by count; decides the word form when the name is translated. */
  measured?: boolean;
  /** Total count when every entry is a bare number ("3 onions"). */
  count?: number;
}

function dimension(unit: UnitKey | undefined): string {
  if (!unit) return 'count';
  if (MASS[unit]) return 'mass';
  if (VOLUME[unit]) return 'volume';
  return unit;
}

function qtyText(items: GroceryItem[], lang: Lang, useDl: boolean): string {
  const withQty = items.filter((i) => i.qty !== undefined);
  if (withQty.length === 0) return '';
  const first = withQty[0].unit;
  if (withQty.every((i) => i.unit === first)) {
    const sum = withQty.reduce((a, i) => a + i.qty!, 0);
    // Metric sums roll over to the bigger unit below (1000 g → 1 kg); everything else stays in its own unit.
    const rollsOver = (first === 'g' && sum >= 1000) || (first === 'ml' && sum >= 1000) || (first === 'dl' && sum >= 10);
    if (!rollsOver) {
      const shown = first && (MASS[first] || VOLUME[first]) ? roundNice(sum) : sum;
      return [formatQty(shown, first, lang), first ? unitLabel(first, lang, sum) : ''].filter(Boolean).join(' ');
    }
  }
  const dim = dimension(first);
  if (dim === 'mass') {
    const g = withQty.reduce((a, i) => a + i.qty! * MASS[i.unit!]!, 0);
    return g >= 1000 ? `${formatQty(g / 1000, 'kg', lang)} kg` : `${formatQty(roundNice(g), 'g', lang)} g`;
  }
  if (dim === 'volume') {
    const ml = withQty.reduce((a, i) => a + i.qty! * VOLUME[i.unit!]!, 0);
    if (ml >= 1000) return `${formatQty(ml / 1000, 'l', lang)} l`;
    if (useDl && ml >= 50) return `${formatQty(Math.round(ml / 50) / 2, 'dl', lang)} dl`;
    return `${formatQty(roundNice(ml), 'ml', lang)} ml`;
  }
  return '';
}

/** Combines duplicate ingredients across recipes ("2 onions" + "1 onion" → "3 onions"). */
export function mergeGroceries(items: GroceryItem[], lang: Lang, useDl: boolean): MergedItem[] {
  const groups = new Map<string, GroceryItem[]>();
  for (const it of items) {
    const food = matchFood(it.name);
    // Same food and same kind of measure merge; unknown foods merge on their normalised name.
    const base = food && normalizeName(it.name).split(' ').length <= 3 ? `f:${food.id}` : `n:${normalizeName(it.name)}`;
    const key = `${base}|${dimension(it.unit)}`;
    const g = groups.get(key);
    if (g) g.push(it);
    else groups.set(key, [it]);
  }
  const out: MergedItem[] = [];
  for (const [key, g] of groups) {
    out.push({
      key,
      name: g[0].name,
      qtyText: qtyText(g, lang, useDl),
      ids: g.map((i) => i.id),
      checked: g.every((i) => i.checked),
      aisle: g[0].aisle,
      recipes: [...new Set(g.map((i) => i.recipeTitle).filter((t): t is string => !!t))],
      measured: g.some((i) => i.qty !== undefined && !!i.unit),
      count: g.every((i) => i.qty !== undefined && !i.unit) ? g.reduce((a, i) => a + i.qty!, 0) : undefined,
    });
  }
  return out;
}

/** A cart item's name, in the app's language when it is a known food and translation is on. */
export function cartName(name: string, lang: Lang, translate: boolean, form: { measured?: boolean; count?: number }): string {
  if (!translate) return name;
  return translateName(name, lang, { measured: !!form.measured, qty: form.count }) ?? name;
}

export function itemLabel(it: GroceryItem, lang: Lang, translate = false): string {
  const name = cartName(it.name, lang, translate, { measured: it.qty !== undefined && !!it.unit, count: it.unit ? undefined : it.qty });
  if (it.qty === undefined) return name;
  return [formatQty(it.qty, it.unit, lang), it.unit ? unitLabel(it.unit, lang, it.qty) : '', name].filter(Boolean).join(' ');
}

export interface Store {
  id: string;
  name: string;
  country: 'LT' | 'DK' | '*';
  search: (q: string) => string;
}

/**
 * Online grocers we can deep-link into. None of them offers a public ordering API,
 * so "order" means opening the store's search for each item — not a pre-filled basket.
 */
export const STORES: Store[] = [
  { id: 'barbora', name: 'Barbora', country: 'LT', search: (q) => `https://barbora.lt/paieska?q=${encodeURIComponent(q)}` },
  { id: 'rimi-lt', name: 'Rimi', country: 'LT', search: (q) => `https://www.rimi.lt/e-parduotuve/lt/paieska?query=${encodeURIComponent(q)}` },
  { id: 'nemlig', name: 'nemlig.com', country: 'DK', search: (q) => `https://www.nemlig.com/?search=${encodeURIComponent(q)}` },
  { id: 'web', name: 'Google', country: '*', search: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
];

export function storesFor(lang: Lang): Store[] {
  const country = lang === 'lt' ? 'LT' : lang === 'da' ? 'DK' : '*';
  const local = STORES.filter((s) => s.country === country);
  const rest = STORES.filter((s) => s.country !== country);
  return [...local, ...rest];
}
