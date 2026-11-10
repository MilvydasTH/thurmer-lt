import { isUsableDraft, parseRecipeText } from './parseText';
import type { MealType, Nutrition, RecipeDraft } from './types';

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°', frac12: '½', frac14: '¼',
  frac34: '¾', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ', eacute: 'é', egrave: 'è',
  auml: 'ä', ouml: 'ö', uuml: 'ü', times: '×',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (whole, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ent] ?? whole;
  });
}

export function stripTags(s: string): string {
  return decodeEntities(
    s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const text = (v: unknown): string => {
  if (typeof v === 'string') return stripTags(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(', ');
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return text(o.name ?? o.text ?? o['@value'] ?? '');
  }
  return '';
};

/** ISO-8601 duration ("PT1H30M") to minutes. */
export function isoDurationToMinutes(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const m = v.match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return undefined;
  const total = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) + (+m[4] || 0) / 60;
  return total > 0 ? Math.round(total) : undefined;
}

function isType(node: Record<string, unknown>, type: string): boolean {
  const t = node['@type'];
  if (typeof t === 'string') return t.toLowerCase() === type.toLowerCase();
  if (Array.isArray(t)) return t.some((x) => typeof x === 'string' && x.toLowerCase() === type.toLowerCase());
  return false;
}

function findRecipeNode(node: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!node || typeof node !== 'object' || depth > 6) return undefined;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipeNode(n, depth + 1);
      if (r) return r;
    }
    return undefined;
  }
  const o = node as Record<string, unknown>;
  if (isType(o, 'Recipe')) return o;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const r = findRecipeNode(o[key], depth + 1);
    if (r) return r;
  }
  return undefined;
}

function imageUrl(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const u = imageUrl(x);
      if (u) return u;
    }
    return undefined;
  }
  if (v && typeof v === 'object') return imageUrl((v as Record<string, unknown>).url);
  return undefined;
}

function instructions(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') {
    return stripTags(v)
      .split(/\n+/)
      .map((s) => s.replace(/^\d{1,2}[.)]\s+/, '').trim())
      .filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap(instructions);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o.itemListElement) return instructions(o.itemListElement);
    const t = text(o.text ?? o.name);
    return t ? [t] : [];
  }
  return [];
}

function list(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(text).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => stripTags(s)).filter(Boolean);
  return [];
}

function firstNumber(v: unknown): number | undefined {
  const s = Array.isArray(v) ? v.map(text).join(' ') : text(v);
  const m = s.match(/\d+(?:[.,]\d+)?/);
  if (!m) return undefined;
  const n = parseFloat(m[0].replace(',', '.'));
  return n > 0 ? n : undefined;
}

const MEAL_WORDS: [RegExp, MealType][] = [
  [/breakfast|brunch|morgenmad|pusryč/i, 'breakfast'],
  [/lunch|frokost|piet/i, 'lunch'],
  [/dinner|main|supper|entr[ée]e|aftensmad|hovedret|vakarien|pagrindin/i, 'dinner'],
  [/snack|appetizer|starter|side|forret|tilbehør|užkand/i, 'snack'],
  [/dessert|cake|baking|kage|desert|pyrag|tort/i, 'dessert'],
  [/drink|beverage|cocktail|smoothie|gėrim|kokteil/i, 'drink'],
];

export function guessMealTypes(words: string[]): MealType[] {
  const out = new Set<MealType>();
  for (const w of words) for (const [re, type] of MEAL_WORDS) if (re.test(w)) out.add(type);
  return [...out];
}

function nutritionFrom(v: unknown, servings: number | undefined): Nutrition | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const kcal = firstNumber(o.calories);
  if (!kcal) return undefined;
  void servings;
  return {
    kcal: Math.round(kcal),
    protein: firstNumber(o.proteinContent) ?? 0,
    carbs: firstNumber(o.carbohydrateContent) ?? 0,
    fat: firstNumber(o.fatContent) ?? 0,
  };
}

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const body = m[1].trim().replace(/^<!--|-->$/g, '').replace(/^\/\*<!\[CDATA\[\*\/|\/\*\]\]>\*\/$/g, '');
    try {
      out.push(JSON.parse(body));
    } catch {
      try {
        // Raw control characters inside strings are the usual reason real-world JSON-LD fails to parse.
        out.push(JSON.parse(body.replace(/[\u0000-\u001f]+/g, ' ')));
      } catch {
        /* skip a broken block */
      }
    }
  }
  return out;
}

export function metaContent(html: string, key: string): string | undefined {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${k}["'][^>]*content\\s*=\\s*"([^"]*)"`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content\\s*=\\s*"([^"]*)"[^>]*(?:property|name)\\s*=\\s*["']${k}["']`, 'i'));
  const c = html.match(new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${k}["'][^>]*content\\s*=\\s*'([^']*)'`, 'i'));
  const v = a?.[1] ?? b?.[1] ?? c?.[1];
  return v ? decodeEntities(v).trim() : undefined;
}

export function hostName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function absolute(url: string | undefined, base: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/** Reads a schema.org Recipe out of a page's JSON-LD — the format nearly every recipe site publishes. */
export function extractJsonLdRecipe(html: string, url: string): RecipeDraft | undefined {
  for (const block of jsonLdBlocks(html)) {
    const node = findRecipeNode(block);
    if (!node) continue;
    const ingredients = list(node.recipeIngredient ?? node.ingredients);
    const steps = instructions(node.recipeInstructions);
    if (ingredients.length === 0 && steps.length === 0) continue;
    const servings = firstNumber(node.recipeYield);
    const categories = [...list(node.recipeCategory), ...list(node.keywords)];
    const prep = isoDurationToMinutes(node.prepTime);
    let cook = isoDurationToMinutes(node.cookTime);
    const totalTime = isoDurationToMinutes(node.totalTime);
    if (cook === undefined && totalTime !== undefined) cook = Math.max(0, totalTime - (prep ?? 0)) || undefined;
    const htmlLang = html.match(/<html[^>]*\slang\s*=\s*["']?([a-zA-Z-]+)/)?.[1];
    return {
      title: text(node.name) || metaContent(html, 'og:title') || '',
      description: text(node.description) || undefined,
      image: absolute(imageUrl(node.image) ?? metaContent(html, 'og:image'), url),
      sourceUrl: url,
      sourceName: text(node.author) || metaContent(html, 'og:site_name') || hostName(url),
      lang: (typeof node.inLanguage === 'string' ? node.inLanguage : htmlLang)?.slice(0, 2).toLowerCase(),
      servings: servings ? Math.round(servings) : undefined,
      prepMin: prep,
      cookMin: cook,
      ingredients,
      steps,
      tags: list(node.keywords).slice(0, 8),
      mealTypes: guessMealTypes(categories),
      cuisine: text(node.recipeCuisine) || undefined,
      nutrition: nutritionFrom(node.nutrition, servings),
    };
  }
  return undefined;
}

export interface PageSummary {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  /** Visible text of the page, trimmed — only useful as input to an AI extractor. */
  bodyText: string;
}

export function summarizePage(html: string, url: string): PageSummary {
  const title = metaContent(html, 'og:title') ?? stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const body = html
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return {
    title: title || undefined,
    description: metaContent(html, 'og:description') ?? metaContent(html, 'description'),
    image: absolute(metaContent(html, 'og:image'), url),
    siteName: metaContent(html, 'og:site_name') ?? hostName(url),
    bodyText: stripTags(body).slice(0, 12000),
  };
}

/**
 * Social captions arrive wrapped by the platform, e.g.
 * `1,234 likes, 56 comments - cook on May 1, 2026: "caption text"`.
 */
export function unwrapSocialCaption(desc: string): string {
  const m = desc.match(/^[\s\S]{0,160}?:\s*["“]([\s\S]+?)["”]\.?\s*$/);
  return (m ? m[1] : desc).trim();
}

export type ImportResult =
  | { ok: true; draft: RecipeDraft; via: 'structured' | 'caption' | 'ai'; partial?: boolean }
  | { ok: false; reason: 'fetch' | 'blocked' | 'norecipe'; summary?: PageSummary };

/**
 * No-AI import pipeline for a fetched page: structured data first, then the page's
 * caption/description run through the text parser.
 */
export function importFromHtml(html: string, url: string): ImportResult {
  const structured = extractJsonLdRecipe(html, url);
  if (structured && (structured.ingredients.length > 0 || structured.steps.length > 0)) {
    return { ok: true, draft: structured, via: 'structured' };
  }
  const summary = summarizePage(html, url);
  if (summary.description) {
    const caption = unwrapSocialCaption(summary.description);
    const draft = parseRecipeText(caption);
    if (isUsableDraft(draft)) {
      return {
        ok: true,
        via: 'caption',
        partial: true,
        draft: {
          ...draft,
          title: draft.title || summary.title || '',
          image: summary.image,
          sourceUrl: url,
          sourceName: summary.siteName,
        },
      };
    }
  }
  return { ok: false, reason: 'norecipe', summary };
}

const SOCIAL_HOSTS = /(^|\.)(instagram\.com|tiktok\.com|facebook\.com|fb\.watch|youtube\.com|youtu\.be|pinterest\.[a-z.]+|pin\.it|threads\.net)$/i;

export function isSocialUrl(url: string): boolean {
  return SOCIAL_HOSTS.test(hostName(url));
}

/** Pulls the first http(s) link out of whatever the share sheet or clipboard handed over. */
export function firstUrl(s: string): string | undefined {
  const m = s.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.]+$/, '') : undefined;
}
