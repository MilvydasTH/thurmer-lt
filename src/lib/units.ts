import type { Ingredient, Lang, UnitKey } from './types';

/** Aliases are stored lowercase, without dots. Multi-word aliases are allowed. */
const ALIASES: Record<UnitKey, string[]> = {
  g: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes', 'gramas', 'gramai', 'gramų', 'gramo'],
  kg: ['kg', 'kilo', 'kilogram', 'kilograms', 'kilogramas', 'kilogramai', 'kilogramo', 'kilogramų'],
  ml: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'mililitras', 'mililitrai', 'mililitrų'],
  cl: ['cl', 'centiliter', 'centilitre'],
  dl: ['dl', 'deciliter', 'decilitre', 'deciliters', 'decilitres', 'decilitras', 'decilitrai'],
  l: ['l', 'liter', 'liters', 'litre', 'litres', 'litras', 'litrai', 'litro', 'litrų'],
  tsp: [
    'tsp', 'tsps', 'teaspoon', 'teaspoons', 'tsk', 'teske', 'teskefuld', 'teskefulde',
    'aš', 'a š', 'arbš', 'arb š', 'arbatinis šaukštelis', 'arbatiniai šaukšteliai', 'arbatinių šaukštelių',
    'arbatinio šaukštelio', 'šaukštelis', 'šaukšteliai', 'šaukštelių', 'šaukštelio',
  ],
  tbsp: [
    'tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons', 'spsk', 'spiseske', 'spiseskefuld', 'spiseskefulde',
    'vš', 'v š', 'valgš', 'valg š', 'valgomasis šaukštas', 'valgomieji šaukštai', 'valgomųjų šaukštų',
    'valgomojo šaukšto', 'šaukštas', 'šaukštai', 'šaukštų', 'šaukšto',
  ],
  cup: ['cup', 'cups', 'c', 'kop', 'kopper', 'stiklinė', 'stiklinės', 'stiklinių', 'stiklinę', 'stikl'],
  floz: ['fl oz', 'floz', 'fluid ounce', 'fluid ounces'],
  pint: ['pint', 'pints', 'pt'],
  quart: ['quart', 'quarts', 'qt'],
  oz: ['oz', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  piece: ['pc', 'pcs', 'piece', 'pieces', 'stk', 'styk', 'stykker', 'vnt', 'vienetas', 'vienetai', 'vienetų'],
  pinch: ['pinch', 'pinches', 'knsp', 'knivspids', 'nip', 'žiupsnelis', 'žiupsnis', 'žiupsnelio', 'žiupsnelį', 'žiupsn'],
  clove: ['clove', 'cloves', 'fed', 'skiltelė', 'skiltelės', 'skiltelių', 'skiltelę', 'skilt'],
  can: ['can', 'cans', 'tin', 'tins', 'dåse', 'dåser', 'ds', 'skardinė', 'skardinės', 'skardinių', 'skardinę', 'skard'],
  pack: ['pack', 'packs', 'package', 'packages', 'packet', 'packets', 'pakke', 'pakker', 'pk', 'pakelis', 'pakeliai', 'pakelių', 'pakelį', 'pak'],
  slice: ['slice', 'slices', 'skive', 'skiver', 'riekė', 'riekės', 'riekių', 'riekelė', 'riekelės', 'griežinėlis', 'griežinėliai', 'griežinėlių'],
  bunch: ['bunch', 'bunches', 'bundt', 'bdt', 'ryšelis', 'ryšelio', 'ryšulėlis', 'ryšulėlio', 'ryšelį'],
};

const ALIAS_TO_UNIT = new Map<string, UnitKey>();
for (const [unit, list] of Object.entries(ALIASES) as [UnitKey, string[]][]) {
  for (const a of list) ALIAS_TO_UNIT.set(a, unit);
}

const UNIT_LABELS: Record<Lang, Record<UnitKey, string>> = {
  en: {
    g: 'g', kg: 'kg', ml: 'ml', cl: 'cl', dl: 'dl', l: 'l', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup',
    floz: 'fl oz', pint: 'pint', quart: 'quart', oz: 'oz', lb: 'lb', piece: 'pc', pinch: 'pinch',
    clove: 'clove', can: 'can', pack: 'pack', slice: 'slice', bunch: 'bunch',
  },
  da: {
    g: 'g', kg: 'kg', ml: 'ml', cl: 'cl', dl: 'dl', l: 'l', tsp: 'tsk', tbsp: 'spsk', cup: 'kop',
    floz: 'fl oz', pint: 'pint', quart: 'quart', oz: 'oz', lb: 'lb', piece: 'stk.', pinch: 'knsp.',
    clove: 'fed', can: 'dåse', pack: 'pk.', slice: 'skive', bunch: 'bundt',
  },
  lt: {
    g: 'g', kg: 'kg', ml: 'ml', cl: 'cl', dl: 'dl', l: 'l', tsp: 'a. š.', tbsp: 'v. š.', cup: 'stikl.',
    floz: 'fl oz', pint: 'pint', quart: 'kvorta', oz: 'oz', lb: 'lb', piece: 'vnt.', pinch: 'žiupsn.',
    clove: 'skilt.', can: 'skard.', pack: 'pak.', slice: 'riek.', bunch: 'ryš.',
  },
};

const EN_PLURALS: Partial<Record<UnitKey, string>> = {
  cup: 'cups', clove: 'cloves', can: 'cans', pack: 'packs', slice: 'slices', bunch: 'bunches',
  pinch: 'pinches', pint: 'pints', quart: 'quarts', piece: 'pcs',
};

export function unitLabel(unit: UnitKey, lang: Lang, qty = 1): string {
  if (lang === 'en' && qty > 1 && EN_PLURALS[unit]) return EN_PLURALS[unit]!;
  return UNIT_LABELS[lang][unit];
}

const VULGAR: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};
const VULGAR_CLASS = '[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]';
const NUM = `(?:\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?\\s*${VULGAR_CLASS}?|${VULGAR_CLASS})`;
const QTY_RE = new RegExp(`^(${NUM})(?:\\s*(?:-|–|—|to|til|iki)\\s*(${NUM}))?\\s*`, 'i');

function parseNumber(s: string): number | undefined {
  s = s.trim();
  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) return +m[1] + +m[2] / +m[3];
  m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return +m[2] === 0 ? undefined : +m[1] / +m[2];
  const last = s[s.length - 1];
  if (VULGAR[last] !== undefined) {
    const head = s.slice(0, -1).trim().replace(',', '.');
    return (head ? parseFloat(head) : 0) + VULGAR[last];
  }
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

const BULLET_RE = /^\s*(?:[-–—•*·▢□☐✓✔▪◦●○]+|\[\s?[xX]?\s?\])\s*/;

export function cleanLine(line: string): string {
  return line.replace(BULLET_RE, '').replace(/\s+/g, ' ').trim();
}

let counter = 0;
export function uid(): string {
  counter = (counter + 1) % 1e6;
  return Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 7);
}

function matchUnit(rest: string): { unit: UnitKey; len: number } | undefined {
  // Tokens may carry dots ("a. š.", "tsk.", "vnt.") — strip them for lookup.
  const tokenRe = /^(\S+)(\s+(\S+))?/;
  const m = rest.match(tokenRe);
  if (!m) return undefined;
  const norm = (s: string) => s.toLowerCase().replace(/\./g, '').replace(/[,;:]$/, '');
  if (m[3]) {
    const a = norm(m[1]);
    const b = norm(m[3]);
    const two = ALIAS_TO_UNIT.get(`${a} ${b}`) ?? (a.length <= 4 && b.length <= 2 ? ALIAS_TO_UNIT.get(a + b) : undefined);
    if (two) return { unit: two, len: m[0].length };
  }
  const one = ALIAS_TO_UNIT.get(norm(m[1]));
  if (one) {
    // A bare "c" or "l" followed by nothing is more likely a typo than a unit.
    return { unit: one, len: m[1].length };
  }
  return undefined;
}

const TRAILING_RE = new RegExp(
  `^(.*?\\p{L}.*?)(\\s*[:–—-]\\s*|\\s*\\(\\s*|\\s+)(${NUM})(?:\\s*(?:-|–|—|to|til|iki)\\s*(${NUM}))?\\s*([^\\d()]{0,24}?)\\s*\\)?\\.?$`,
  'iu',
);

/**
 * Lines that put the amount last, as many posts and shopping notes do:
 * "Turmeric – 100 g", "Ciberžolė: 2 vnt.", "Lemons (3)", "Ginger 50 g".
 * Without a recognised unit, a separator is required, so "Vitamin B 12" is left alone.
 */
function parseTrailingAmount(raw: string, base: Ingredient): Ingredient | undefined {
  const m = raw.match(TRAILING_RE);
  if (!m) return undefined;
  const qty = parseNumber(m[3]);
  if (qty === undefined) return undefined;
  const unitText = m[5].trim();
  let unit: UnitKey | undefined;
  if (unitText) {
    const u = matchUnit(unitText);
    if (!u || unitText.slice(u.len).replace(/[.\s]/g, '') !== '') return undefined;
    unit = u.unit;
  } else if (!/[:–—(-]/.test(m[2])) {
    return undefined;
  }
  const name = m[1].replace(/[\s:–—(-]+$/, '').trim();
  if (!name) return undefined;
  return { ...base, qty, qtyMax: m[4] ? parseNumber(m[4]) : undefined, unit, name };
}

/** Parses one ingredient line such as "1 1/2 cups flour", "2 spsk smør" or "200 g miltų". */
export function parseIngredient(line: string): Ingredient {
  const raw = cleanLine(line);
  const base: Ingredient = { id: uid(), raw, name: raw };
  if (!raw) return base;
  if (/[:：]$/.test(raw) && !/^\d/.test(raw)) {
    return { ...base, header: true, name: raw.replace(/[:：]$/, '').trim() };
  }
  if (/^#+\s*/.test(raw)) {
    return { ...base, header: true, name: raw.replace(/^#+\s*/, '').trim() };
  }
  const q = raw.match(QTY_RE);
  if (!q) return parseTrailingAmount(raw, base) ?? base;
  const qty = parseNumber(q[1]);
  if (qty === undefined) return base;
  const qtyMax = q[2] ? parseNumber(q[2]) : undefined;
  let rest = raw.slice(q[0].length);
  // "2 x 400 g" style multipliers are too ambiguous to scale safely; keep the first number only.
  let unit: UnitKey | undefined;
  const u = matchUnit(rest);
  if (u) {
    const after = rest.slice(u.len);
    // Require a boundary so "2 lemons" is not read as 2 l "emons".
    if (after === '' || /^[\s.,)]/.test(after)) {
      unit = u.unit;
      rest = after.replace(/^[.\s]+/, '');
    }
  }
  rest = rest.replace(/^(?:of|af)\s+/i, '').trim();
  return { ...base, qty, qtyMax, unit, name: rest || raw };
}

export function parseIngredientLines(lines: string[]): Ingredient[] {
  return lines.map(cleanLine).filter(Boolean).map(parseIngredient);
}

/** Lowercase, strip punctuation and parenthesised notes: used as a merge key. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,.*$/, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
