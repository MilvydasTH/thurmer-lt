import { matchFood, type Food } from '../data/foods';
import type { Ingredient, Lang, UnitKey, UnitSystem } from './types';
import { unitLabel } from './units';

const ML: Partial<Record<UnitKey, number>> = {
  ml: 1, cl: 10, dl: 100, l: 1000, tsp: 5, tbsp: 15, cup: 240, floz: 29.57, pint: 473, quart: 946,
};
const GRAMS: Partial<Record<UnitKey, number>> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };

/** Foods measured by volume that should stay a volume when converting cups to metric. */
const LIQUIDS = new Set([
  'milk', 'cream', 'kefir', 'oil', 'oliveoil', 'vinegar', 'soysauce', 'stock', 'water', 'wine', 'juice',
  'coconutmilk', 'lemonjuice', 'cannedtomato', 'yogurt', 'sourcream',
]);

const METRIC_UNITS = new Set<UnitKey>(['g', 'kg', 'ml', 'cl', 'dl', 'l']);
const US_ONLY = new Set<UnitKey>(['cup', 'floz', 'pint', 'quart', 'oz', 'lb']);

export function roundNice(x: number): number {
  if (x >= 100) return Math.round(x / 5) * 5;
  if (x >= 10) return Math.round(x);
  return Math.round(x * 10) / 10;
}

function normalizeMass(g: number): { qty: number; unit: UnitKey } {
  if (g >= 1000) return { qty: Math.round(g / 10) / 100, unit: 'kg' };
  return { qty: roundNice(g), unit: 'g' };
}

function normalizeVolume(ml: number, useDl: boolean): { qty: number; unit: UnitKey } {
  if (ml >= 1000) return { qty: Math.round(ml / 50) / 20, unit: 'l' };
  if (useDl && ml >= 50) return { qty: Math.round(ml / 50) / 2, unit: 'dl' };
  return { qty: roundNice(ml), unit: 'ml' };
}

export interface ConvertOptions {
  system: UnitSystem;
  useDl: boolean;
}

export function convertQty(
  qty: number,
  unit: UnitKey | undefined,
  name: string,
  opts: ConvertOptions,
): { qty: number; unit: UnitKey | undefined } {
  if (!unit) return { qty, unit };
  if (opts.system === 'metric') {
    if (unit === 'oz' || unit === 'lb') return normalizeMass(qty * GRAMS[unit]!);
    if (US_ONLY.has(unit)) {
      const food = matchFood(name);
      if (unit === 'cup' && food && food.gPerCup > 0 && !LIQUIDS.has(food.id)) {
        return normalizeMass(qty * food.gPerCup);
      }
      return normalizeVolume(qty * ML[unit]!, opts.useDl);
    }
    if (unit === 'g' || unit === 'kg') return normalizeMass(qty * GRAMS[unit]!);
    if (unit === 'ml' || unit === 'cl' || unit === 'l') return normalizeVolume(qty * ML[unit]!, opts.useDl);
    if (unit === 'dl') return qty >= 10 ? normalizeVolume(qty * 100, true) : { qty, unit };
    return { qty, unit };
  }
  if (opts.system === 'us') {
    if (unit === 'g' || unit === 'kg') {
      const oz = (qty * GRAMS[unit]!) / 28.35;
      if (oz >= 16) return { qty: Math.round((oz / 16) * 4) / 4, unit: 'lb' };
      return { qty: oz >= 4 ? Math.round(oz) : Math.round(oz * 4) / 4, unit: 'oz' };
    }
    if (METRIC_UNITS.has(unit)) {
      const ml = qty * ML[unit]!;
      if (ml < 15) return { qty: ml / 5, unit: 'tsp' };
      if (ml < 60) return { qty: ml / 15, unit: 'tbsp' };
      return { qty: ml / 240, unit: 'cup' };
    }
  }
  // No conversion asked for, but a scaled metric amount should still roll over: 1000 g → 1 kg.
  if (unit === 'g' && qty >= 1000) return normalizeMass(qty);
  if (unit === 'ml' && qty >= 1000) return normalizeVolume(qty, false);
  if (unit === 'dl' && qty >= 10) return normalizeVolume(qty * 100, true);
  return { qty, unit };
}

const FRACTIONS: [number, string][] = [
  [0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, ''],
];
const EIGHTHS: [number, string][] = [[0.125, '⅛'], [0.375, '⅜'], [0.625, '⅝'], [0.875, '⅞']];
const SPOONS_AND_CUPS = new Set<UnitKey>(['cup', 'tbsp', 'tsp']);

export function formatQty(qty: number, unit: UnitKey | undefined, lang: Lang): string {
  const comma = lang !== 'en';
  const dec = (n: number, places: number) => {
    const s = String(Math.round(n * 10 ** places) / 10 ** places);
    return comma ? s.replace('.', ',') : s;
  };
  if (unit && METRIC_UNITS.has(unit)) return dec(qty, unit === 'kg' || unit === 'l' ? 2 : 1);
  // Nobody measures 0.83 cup: spoons and cups always land on the nearest fraction a measuring set has.
  const kitchen = !!unit && SPOONS_AND_CUPS.has(unit);
  if (qty < 0.1) return dec(qty, 2);
  const options = kitchen ? [...FRACTIONS, ...EIGHTHS] : FRACTIONS;
  const whole = Math.floor(qty);
  const frac = qty - whole;
  let best = options[0];
  for (const f of options) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  // For counts, only snap when it is close; otherwise a decimal is more honest than a wrong fraction.
  if (!kitchen && Math.abs(best[0] - frac) > 0.06) return dec(qty, 1);
  const w = whole + (best[0] === 1 ? 1 : 0);
  if (!best[1]) return w === 0 ? dec(qty, 2) : String(w);
  return w > 0 ? `${w} ${best[1]}` : best[1];
}

export interface DisplayOptions extends ConvertOptions {
  scale: number;
  lang: Lang;
  /** Language the ingredient text is written in; enables plural fixes for English. */
  contentLang?: string;
}

const UNCOUNTABLE = /^(garlic|butter|salt|pepper|sugar|flour|rice|water|milk|oil|parsley|basil|dill|spinach|broccoli|bread|cheese|pasta|ginger|celery|corn|bacon|ham|fish|salmon|tuna|cod|beef|pork|chicken)$/i;

function pluralWord(w: string): string {
  if (UNCOUNTABLE.test(w) || /s$/i.test(w)) return w;
  if (/(leaf|loaf|half)$/i.test(w)) return w.replace(/f$/i, 'ves');
  if (/[^aeiou]y$/i.test(w)) return w.replace(/y$/i, 'ies');
  if (/(ch|sh|x|z|tomato|potato)$/i.test(w)) return `${w}es`;
  return `${w}s`;
}

function singularWord(w: string): string {
  if (/(leaves|loaves|halves)$/i.test(w)) return w.replace(/ves$/i, 'f');
  if (/[^aeiou]ies$/i.test(w)) return w.replace(/ies$/i, 'y');
  if (/(ches|shes|xes|zes|tomatoes|potatoes)$/i.test(w)) return w.replace(/es$/i, '');
  if (/[^su]s$/i.test(w)) return w.replace(/s$/i, '');
  return w;
}

/**
 * "1 onion" doubled should read "2 onions", and "2 eggs" halved "1 egg". Only the noun right
 * before the first comma or bracket is touched, and only for English text — other languages
 * inflect in ways a suffix rule would get wrong, so they are left exactly as written.
 */
export function agreeEnglishNoun(name: string, before: number, after: number): string {
  const wasPlural = before > 1;
  const isPlural = after > 1;
  if (wasPlural === isPlural) return name;
  const m = name.match(/^([^,(]*?)([A-Za-z]+)(\s*(?:[,(].*)?)$/);
  if (!m) return name;
  const word = isPlural ? pluralWord(m[2]) : singularWord(m[2]);
  return `${m[1]}${word}${m[3]}`;
}

function unitChanges(unit: UnitKey | undefined, system: UnitSystem): boolean {
  if (!unit || system === 'original') return false;
  if (system === 'metric') return US_ONLY.has(unit);
  return METRIC_UNITS.has(unit);
}

/**
 * Renders an ingredient line. When nothing needs to change (no scaling, no unit conversion)
 * the original line is returned untouched, so imported text is never mangled.
 */
export function displayIngredient(ing: Ingredient, opts: DisplayOptions): string {
  if (ing.header) return ing.name;
  if (ing.qty === undefined) return ing.raw;
  const scaled = Math.abs(opts.scale - 1) > 1e-6;
  if (!scaled && !unitChanges(ing.unit, opts.system)) return ing.raw;

  const a = convertQty(ing.qty * opts.scale, ing.unit, ing.name, opts);
  let qtyText = formatQty(a.qty, a.unit, opts.lang);
  if (ing.qtyMax !== undefined) {
    const b = convertQty(ing.qtyMax * opts.scale, ing.unit, ing.name, opts);
    if (b.unit === a.unit) qtyText += `–${formatQty(b.qty, b.unit, opts.lang)}`;
  }
  const u = a.unit ? unitLabel(a.unit, opts.lang, a.qty) : '';
  const english = (opts.contentLang ?? opts.lang) === 'en';
  const name = !a.unit && english && ing.qtyMax === undefined ? agreeEnglishNoun(ing.name, ing.qty, a.qty) : ing.name;
  return [qtyText, u, name].filter(Boolean).join(' ');
}

const TEMP_RE = /(\d{2,3})\s*(?:(?:°|º|degrees?|deg\.?|grader|laipsni\p{L}*)\s*(F|C|fahrenheit|celsius)(?!\p{L})|(F)(?!\p{L}))/giu;

/** Rewrites oven temperatures in step text to the preferred scale. */
export function convertTemperatures(text: string, system: UnitSystem): string {
  if (system === 'original') return text;
  return text.replace(TEMP_RE, (whole, num: string, scaleA?: string, scaleB?: string) => {
    const n = Number(num);
    const isF = (scaleA ?? scaleB ?? '').toLowerCase().startsWith('f');
    if (system === 'metric' && isF) return `${Math.round(((n - 32) * 5) / 9 / 5) * 5} °C`;
    if (system === 'us' && !isF) return `${Math.round((n * 9) / 5 / 25 + 32 / 25) * 25} °F`;
    return whole;
  });
}

/** Approximate weight of an ingredient in grams, or undefined when it cannot be estimated. */
export function toGrams(qty: number | undefined, unit: UnitKey | undefined, food: Food | undefined): number | undefined {
  if (qty === undefined) return undefined;
  if (unit && GRAMS[unit]) return qty * GRAMS[unit]!;
  if (unit && ML[unit]) {
    if (!food || food.gPerCup <= 0) return undefined;
    return qty * ML[unit]! * (food.gPerCup / 240);
  }
  if (!food) return undefined;
  switch (unit) {
    case undefined:
    case 'piece':
      return food.gPerPiece > 0 ? qty * food.gPerPiece : undefined;
    case 'clove':
      return qty * (food.id === 'garlic' ? 5 : food.gPerPiece || 5);
    case 'slice':
      return qty * (food.gPerPiece || 20);
    case 'pinch':
      return qty * 0.4;
    case 'can':
      return qty * 400;
    case 'bunch':
      return qty * 30;
    default:
      return undefined;
  }
}
