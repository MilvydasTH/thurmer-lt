import { FOOD_NAMES } from '../data/foodNames';
import { englishName, locateFood } from '../data/foods';
import type { Lang } from './types';

/** How the ingredient is being bought or used, which decides the word form. */
export interface NameForm {
  /** Follows a unit ("500 g …", "2 dl …"). */
  measured: boolean;
  /** A bare count ("3 …"); undefined when there is no amount at all. */
  qty?: number;
}

/** Lithuanian genitive singular of countable foods, for fractional counts ("1,5 svogūno"). */
const LT_GEN_SG: Record<string, string> = {
  onion: 'svogūno', tomato: 'pomidoro', potato: 'bulvės', sweetpotato: 'batato', carrot: 'morkos', cucumber: 'agurko',
  bellpepper: 'paprikos', zucchini: 'cukinijos', eggplant: 'baklažano', cabbage: 'kopūsto', broccoli: 'brokolio',
  cauliflower: 'žiedinio kopūsto', mushroom: 'grybo', beetroot: 'burokėlio', lemon: 'citrinos', lime: 'laimo',
  apple: 'obuolio', banana: 'banano', orange: 'apelsino', strawberry: 'braškės', avocado: 'avokado',
  springonion: 'svogūno laiško', chili: 'čili pipiro', leek: 'poro', radish: 'ridikėlio', pumpkin: 'moliūgo',
  egg: 'kiaušinio', chickenthigh: 'vištienos šlaunelės', sausage: 'dešrelės', tortilla: 'tortilijos',
};

function lithuanian(id: string, forms: string[], f: NameForm): string {
  const [gen, nomSg, nomPl, genPl] = forms;
  if (f.measured) return gen;
  if (f.qty === undefined || !nomPl) return nomSg ?? gen;
  if (!Number.isInteger(f.qty)) return LT_GEN_SG[id] ?? nomPl;
  const n = Math.abs(f.qty);
  const last = n % 10;
  const teens = n % 100 >= 11 && n % 100 <= 19;
  if (last === 1 && !teens) return nomSg;
  if (last >= 2 && !teens) return nomPl;
  return genPl ?? gen;
}

function englishPlural(w: string): string {
  if (/s$/i.test(w)) return w;
  if (/(leaf|loaf|half)$/i.test(w)) return w.replace(/f$/i, 'ves');
  if (/[^aeiou]y$/i.test(w)) return w.replace(/y$/i, 'ies');
  if (/(ch|sh|x|z|tomato|potato)$/i.test(w)) return `${w}es`;
  return `${w}s`;
}

/** The food's name in the given language, in the form that fits the amount. */
export function foodName(id: string, lang: Lang, f: NameForm): string | undefined {
  const names = FOOD_NAMES[id];
  if (!names) return undefined;
  const da = names.da.split('|');
  const countable = da.length > 1;
  const many = f.measured || (f.qty !== undefined && f.qty > 1);
  if (lang === 'da') return countable && many ? da[1] : da[0];
  if (lang === 'lt') return lithuanian(id, names.lt.split('|'), f);
  const en = englishName(id);
  if (!en) return undefined;
  return countable && many ? englishPlural(en) : en;
}

/**
 * Shows an ingredient name in the app's language when it is a food we know: "minced pork" →
 * "hakket svinekød" / "maltos kiaulienos". Words around the food that we cannot translate are
 * kept in brackets ("large eggs" → "æg (large)") rather than dropped. Returns undefined when
 * the name is already in that language, is not a known food, or names a different product
 * that only shares a row in the food table.
 *
 * `sourceLang`, when known, guards against a word that happens to be a food name in another
 * language ("is" is ice cream in Danish).
 */
export function translateName(name: string, lang: Lang, f: NameForm, sourceLang?: string): string | undefined {
  const hit = locateFood(name);
  if (!hit || hit.other || hit.langs.includes(lang)) return undefined;
  if (sourceLang && (sourceLang === 'en' || sourceLang === 'da' || sourceLang === 'lt') && !hit.langs.includes(sourceLang)) return undefined;
  const target = foodName(hit.food.id, lang, f);
  if (!target) return undefined;
  const rest = `${name.slice(0, hit.start)} ${name.slice(hit.end)}`
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '')
    .replace(/^(?:of|af)\s+/i, '')
    .replace(/\s+,/g, ',')
    .trim();
  const capital = hit.start === 0 && /^\p{Lu}/u.test(name);
  const shown = capital ? target[0].toUpperCase() + target.slice(1) : target;
  return rest ? `${shown} (${rest})` : shown;
}
