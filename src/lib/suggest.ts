import { matchFood } from '../data/foods';
import { isPantryItem } from './grocery';
import type { Ingredient, PlanEntry, Recipe } from './types';
import { normalizeName } from './units';

/** Something the cook has at home: a food we know ("f:potato") or free text ("n:dragon fruit"). */
export type OnHand = string;

export function onHandKey(text: string): OnHand | undefined {
  const name = normalizeName(text);
  if (!name) return undefined;
  const food = matchFood(name);
  return food ? `f:${food.id}` : `n:${name}`;
}

function has(ing: Ingredient, onHand: Set<OnHand>): boolean {
  const food = matchFood(ing.name);
  if (food && onHand.has(`f:${food.id}`)) return true;
  const name = normalizeName(ing.name);
  for (const key of onHand) if (key.startsWith('n:') && name.includes(key.slice(2))) return true;
  return false;
}

export interface CookMatch {
  recipe: Recipe;
  /** Ingredients covered by what is at home (pantry staples count as covered). */
  have: number;
  total: number;
  /** How many of the things the cook listed this recipe actually uses. */
  uses: number;
  missing: Ingredient[];
}

/**
 * "What can I cook?": recipes ranked by how little is missing, given what is at home.
 * Only recipes that use at least one listed thing are returned, so adding "eggs" does not
 * surface every recipe that merely needs salt.
 */
export function cookFrom(recipes: Recipe[], onHand: OnHand[], pantry: string[]): CookMatch[] {
  const set = new Set(onHand);
  if (set.size === 0) return [];
  const out: CookMatch[] = [];
  for (const recipe of recipes) {
    const items = recipe.ingredients.filter((i) => !i.header && i.name.trim());
    if (items.length === 0) continue;
    let uses = 0;
    const missing: Ingredient[] = [];
    for (const ing of items) {
      if (has(ing, set)) uses++;
      else if (!isPantryItem(ing.name, pantry)) missing.push(ing);
    }
    if (uses === 0) continue;
    out.push({ recipe, have: items.length - missing.length, total: items.length, uses, missing });
  }
  return out.sort((a, b) => a.missing.length - b.missing.length || b.uses - a.uses || a.recipe.title.localeCompare(b.recipe.title));
}

/** Foods that spoil: sharing these between meals is what cuts waste and shopping. */
const PERISHABLE = new Set(['produce', 'dairy', 'meat', 'bakery']);

function perishables(recipe: Recipe): Set<string> {
  const out = new Set<string>();
  for (const ing of recipe.ingredients) {
    if (ing.header) continue;
    const food = matchFood(ing.name);
    if (food && PERISHABLE.has(food.aisle)) out.add(food.id);
  }
  return out;
}

/**
 * Picks dinners for the days that have none. Starts from a favourite, then keeps choosing the
 * recipe that shares the most fresh ingredients with the ones already picked, so half a cabbage
 * bought on Monday gets used on Wednesday. No recipe repeats until every candidate has been used.
 * `random` is injectable so the choice can be tested.
 */
export function fillDinners(recipes: Recipe[], dates: string[], plan: PlanEntry[], random: () => number = Math.random): Omit<PlanEntry, 'id'>[] {
  const empty = dates.filter((d) => !plan.some((p) => p.date === d && p.slot === 'dinner'));
  const pool = recipes.filter((r) => r.steps.length > 0 && (r.mealTypes.length === 0 || r.mealTypes.includes('dinner') || r.mealTypes.includes('lunch')));
  if (empty.length === 0 || pool.length === 0) return [];

  const already = new Set(plan.filter((p) => dates.includes(p.date) && p.recipeId).map((p) => p.recipeId!));
  const used = new Set<string>(already);
  const fresh = new Set<string>();
  for (const r of recipes) if (already.has(r.id)) for (const f of perishables(r)) fresh.add(f);

  const out: Omit<PlanEntry, 'id'>[] = [];
  for (const date of empty) {
    let candidates = pool.filter((r) => !used.has(r.id));
    if (candidates.length === 0) {
      used.clear();
      candidates = pool;
    }
    let best: Recipe[] = [];
    let bestScore = -1;
    for (const r of candidates) {
      let score = 0;
      for (const f of perishables(r)) if (fresh.has(f)) score += 2;
      if (r.favorite) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = [r];
      } else if (score === bestScore) best.push(r);
    }
    const pick = best[Math.min(best.length - 1, Math.floor(random() * best.length))];
    used.add(pick.id);
    for (const f of perishables(pick)) fresh.add(f);
    out.push({ date, slot: 'dinner', recipeId: pick.id });
  }
  return out;
}

/** The distinct known foods across a library, most used first: what to ask the offers service about. */
export function libraryFoods(recipes: Recipe[], pantry: string[], limit = 40): { id: string; da: string; count: number }[] {
  const seen = new Map<string, { id: string; da: string; count: number }>();
  for (const r of recipes) {
    const inRecipe = new Set<string>();
    for (const ing of r.ingredients) {
      if (ing.header || isPantryItem(ing.name, pantry)) continue;
      const food = matchFood(ing.name);
      if (!food || inRecipe.has(food.id)) continue;
      inRecipe.add(food.id);
      const e = seen.get(food.id) ?? { id: food.id, da: food.da, count: 0 };
      e.count++;
      seen.set(food.id, e);
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)).slice(0, limit);
}

/** Recipes ranked by how many of their ingredients are on offer this week. */
export function rankByOffers(recipes: Recipe[], onOffer: Set<string>): { recipe: Recipe; foods: string[] }[] {
  const out: { recipe: Recipe; foods: string[] }[] = [];
  for (const recipe of recipes) {
    const foods = new Set<string>();
    for (const ing of recipe.ingredients) {
      if (ing.header) continue;
      const food = matchFood(ing.name);
      if (food && onOffer.has(food.id)) foods.add(food.id);
    }
    if (foods.size > 0) out.push({ recipe, foods: [...foods] });
  }
  return out.sort((a, b) => b.foods.length - a.foods.length || a.recipe.title.localeCompare(b.recipe.title));
}
