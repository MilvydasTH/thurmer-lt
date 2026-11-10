import type { RecipeDraft } from './types';
import { cleanLine, parseIngredient } from './units';

const ING_HEAD =
  /^(ingredients?|ingredienser|ingredientai|ingridientai|you(?:'|’)?ll need|you will need|what you need|du skal bruge|det skal du bruge|reikės|reikalingi produktai|produktai|sudedamosios dalys)\b/i;
const STEP_HEAD =
  /^(method|instructions?|directions?|steps?|preparation|how to make(?: it)?|fremgangsmåde|sådan gør du|tilberedning|opskrift|gaminimas|paruošimas|gaminimo eiga|paruošimo būdas|eiga)\b/i;
const NOTE_HEAD = /^(notes?|tips?|noter|pastabos|patarimai)\b/i;

const SERVINGS_RES = [
  /(?:serves|servings?|yields?|makes|portioner|personer|antal|porcij\p{L}*|išeiga)\s*[:\-–]?\s*(\d{1,3})/iu,
  /(\d{1,3})\s*(?:servings?|portions?|portioner|personer|pers\.?|porcij\p{L}*)/iu,
  /(?:til|for)\s+(\d{1,2})\s+(?:personer|people|persons)/i,
];

const STEP_NUM = /^(?:(?:step|trin|žingsnis)\s*\d+\s*[:.)-]?\s*|\d{1,2}\s*[.):]\s+|\d{1,2}\s*[.)]\s*(?=\p{Lu}))/iu;

function looksLikeIngredient(line: string): boolean {
  if (line.length > 90) return false;
  const ing = parseIngredient(line);
  if (ing.header) return false;
  if (ing.qty !== undefined && (ing.unit || line.length < 50) && !/[.!?]$/.test(line)) return true;
  return false;
}

function minutesFrom(text: string, labels: RegExp): number | undefined {
  const m = text.match(labels);
  if (!m) return undefined;
  const rest = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 40);
  let total = 0;
  const h = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hours?|timer?|val)/i);
  const min = rest.match(/(\d+)\s*(?:m|min|mins|minutes?|minutter|minuč\p{L}*)/iu);
  if (h) total += parseFloat(h[1].replace(',', '.')) * 60;
  if (min) total += parseInt(min[1], 10);
  return total > 0 ? Math.round(total) : undefined;
}

/** Removes trailing hashtag walls and @mentions that social captions end with. */
export function stripSocialNoise(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/u, '').trimEnd())
    .filter((l) => !/^\s*(?:#[\p{L}\p{N}_]+\s*)+$/u.test(l))
    .join('\n');
}

/**
 * Turns free text (a pasted note, a social caption, OCR output) into a recipe draft.
 * Works without any network or AI: it relies on section headings when present and on
 * the shape of each line when not.
 */
export function parseRecipeText(input: string): RecipeDraft {
  const text = stripSocialNoise(input.replace(/\r/g, ''));
  const lines = text.split('\n').map((l) => l.trim());
  const draft: RecipeDraft = { title: '', ingredients: [], steps: [] };
  const desc: string[] = [];
  const notes: string[] = [];
  type Mode = 'pre' | 'ing' | 'steps' | 'notes';
  let mode: Mode = 'pre';
  const hasHeads = lines.some((l) => ING_HEAD.test(cleanLine(l))) || lines.some((l) => STEP_HEAD.test(cleanLine(l)));

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    // Headings may carry content on the same line: "Ingredients: 2 eggs, 1 cup flour"
    const headMatch = (re: RegExp): string | null => {
      const m = line.match(re);
      if (!m) return null;
      const rest = line.slice(m[0].length).replace(/^[\s:：\-–]+/, '');
      // "Steps to success are simple" is prose, not a heading.
      if (rest && !/[:：]/.test(line.slice(0, m[0].length + 3)) && rest.split(' ').length > 6) return null;
      return rest;
    };
    let rest: string | null;
    if ((rest = headMatch(ING_HEAD)) !== null) {
      mode = 'ing';
      if (rest) for (const part of rest.split(/[,;]\s*/)) if (part.trim()) draft.ingredients.push(part.trim());
      continue;
    }
    if ((rest = headMatch(STEP_HEAD)) !== null) {
      mode = 'steps';
      if (rest) draft.steps.push(rest);
      continue;
    }
    if ((rest = headMatch(NOTE_HEAD)) !== null && mode !== 'pre') {
      mode = 'notes';
      if (rest) notes.push(rest);
      continue;
    }

    if (mode === 'pre') {
      if (!draft.title && line.length <= 110 && !looksLikeIngredient(line)) {
        draft.title = line.replace(/[:：]$/, '');
        continue;
      }
      if (!hasHeads) {
        if (looksLikeIngredient(line)) draft.ingredients.push(line);
        else if (STEP_NUM.test(line) || (draft.ingredients.length > 0 && line.length > 25)) {
          draft.steps.push(line.replace(STEP_NUM, ''));
        } else desc.push(line);
      } else desc.push(line);
      continue;
    }
    if (mode === 'ing') {
      // A numbered sentence after the ingredient list means the method started without a heading.
      if (STEP_NUM.test(line) && line.length > 40 && draft.ingredients.length > 0) {
        mode = 'steps';
        draft.steps.push(line.replace(STEP_NUM, ''));
      } else draft.ingredients.push(line);
      continue;
    }
    if (mode === 'steps') {
      const cleaned = line.replace(STEP_NUM, '');
      if (cleaned) draft.steps.push(cleaned);
      continue;
    }
    notes.push(line);
  }

  // A single block of method text: split into sentences-per-step is worse than leaving it whole,
  // but split on explicit inline numbering such as "1. Mix ... 2. Bake ...".
  if (draft.steps.length === 1 && /\s2[.)]\s/.test(draft.steps[0])) {
    draft.steps = draft.steps[0]
      .split(/\s*(?:^|\s)\d{1,2}[.)]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  for (const re of SERVINGS_RES) {
    const m = text.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n <= 100) {
        draft.servings = n;
        break;
      }
    }
  }
  draft.prepMin = minutesFrom(text, /(?:prep(?:aration)?(?: time)?|forberedelse(?:stid)?|paruošimas|paruošimo laikas)\s*[:\-–]?\s*/i);
  draft.cookMin = minutesFrom(text, /(?:cook(?:ing)?(?: time)?|bake time|tilberedning(?:stid)?|bagetid|gaminimo laikas|kepimo laikas)\s*[:\-–]\s*/i);

  // Metadata lines are not prose worth keeping as the description.
  const descClean = desc.filter((l) => !SERVINGS_RES.some((re) => re.test(l)) || l.length > 60);
  if (descClean.length) draft.description = descClean.join('\n');
  if (notes.length) draft.notes = notes.join('\n');
  return draft;
}

/** True when the parse found enough structure to be worth showing as a recipe. */
export function isUsableDraft(d: RecipeDraft): boolean {
  return d.ingredients.length >= 2 || (d.ingredients.length >= 1 && d.steps.length >= 1);
}
