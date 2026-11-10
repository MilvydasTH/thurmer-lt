import { matchFood } from '../data/foods';
import { toGrams } from './convert';
import type { Ingredient, Nutrition } from './types';

export interface NutritionEstimate {
  total: Nutrition;
  perServing: Nutrition;
  /** Ingredients that could not be counted (unknown food or no usable amount). */
  missing: string[];
  counted: number;
  considered: number;
}

/** Foods that add next to nothing; not worth flagging as missing when no amount is given. */
const NEGLIGIBLE = new Set(['salt', 'water', 'pepper', 'bakingsoda', 'driedherbs', 'paprikaspice', 'cumin', 'curry', 'cinnamon', 'vanilla']);

const r1 = (n: number) => Math.round(n * 10) / 10;

export function estimateNutrition(ingredients: Ingredient[], servings: number): NutritionEstimate {
  const total: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const missing: string[] = [];
  let counted = 0;
  let considered = 0;
  for (const ing of ingredients) {
    if (ing.header || !ing.name.trim()) continue;
    const food = matchFood(ing.name);
    const qty = ing.qtyMax !== undefined && ing.qty !== undefined ? (ing.qty + ing.qtyMax) / 2 : ing.qty;
    const grams = toGrams(qty, ing.unit, food);
    if (food && NEGLIGIBLE.has(food.id) && grams === undefined) continue;
    considered++;
    if (!food || grams === undefined) {
      missing.push(ing.name);
      continue;
    }
    counted++;
    total.kcal += (food.kcal * grams) / 100;
    total.protein += (food.protein * grams) / 100;
    total.carbs += (food.carbs * grams) / 100;
    total.fat += (food.fat * grams) / 100;
  }
  const s = Math.max(1, servings || 1);
  return {
    total: { kcal: Math.round(total.kcal), protein: r1(total.protein), carbs: r1(total.carbs), fat: r1(total.fat) },
    perServing: {
      kcal: Math.round(total.kcal / s),
      protein: r1(total.protein / s),
      carbs: r1(total.carbs / s),
      fat: r1(total.fat / s),
    },
    missing,
    counted,
    considered,
  };
}
