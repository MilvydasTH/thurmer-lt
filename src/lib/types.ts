export type Lang = 'en' | 'da' | 'lt';

export type UnitKey =
  | 'g'
  | 'kg'
  | 'ml'
  | 'cl'
  | 'dl'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'floz'
  | 'pint'
  | 'quart'
  | 'oz'
  | 'lb'
  | 'piece'
  | 'pinch'
  | 'clove'
  | 'can'
  | 'pack'
  | 'slice'
  | 'bunch';

export type UnitSystem = 'original' | 'metric' | 'us';

export interface Ingredient {
  id: string;
  /** The line exactly as written or imported. Never rewritten by the app. */
  raw: string;
  qty?: number;
  qtyMax?: number;
  unit?: UnitKey;
  name: string;
  /** A section heading inside the ingredient list, e.g. "For the sauce:" */
  header?: boolean;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'drink';
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drink'];

export type PlanSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const PLAN_SLOTS: PlanSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeTranslation {
  title: string;
  description?: string;
  ingredients: string[];
  steps: string[];
  notes?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  image?: string;
  sourceUrl?: string;
  sourceName?: string;
  /** Language the recipe was written in, when known. */
  lang?: string;
  servings: number;
  prepMin?: number;
  cookMin?: number;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  mealTypes: MealType[];
  cuisine?: string;
  notes?: string;
  favorite: boolean;
  cookbookIds: string[];
  /** Per-serving nutrition supplied by the source or entered by hand; overrides the estimate. */
  nutrition?: Nutrition;
  translations?: Partial<Record<Lang, RecipeTranslation>>;
  createdAt: number;
  updatedAt: number;
}

/** What importers and the editor produce before a recipe is saved. */
export interface RecipeDraft {
  id?: string;
  title: string;
  description?: string;
  image?: string;
  sourceUrl?: string;
  sourceName?: string;
  lang?: string;
  servings?: number;
  prepMin?: number;
  cookMin?: number;
  ingredients: string[];
  steps: string[];
  tags?: string[];
  mealTypes?: MealType[];
  cuisine?: string;
  notes?: string;
  nutrition?: Nutrition;
}

export interface Cookbook {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
}

export interface PlanEntry {
  id: string;
  /** Local date, YYYY-MM-DD */
  date: string;
  slot: PlanSlot;
  recipeId?: string;
  note?: string;
  servings?: number;
}

export type Aisle =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'bakery'
  | 'pantry'
  | 'spices'
  | 'canned'
  | 'frozen'
  | 'drinks'
  | 'other';

export const AISLES: Aisle[] = [
  'produce',
  'bakery',
  'dairy',
  'meat',
  'pantry',
  'canned',
  'spices',
  'frozen',
  'drinks',
  'other',
];

export interface GroceryItem {
  id: string;
  name: string;
  qty?: number;
  unit?: UnitKey;
  aisle: Aisle;
  checked: boolean;
  recipeId?: string;
  recipeTitle?: string;
  createdAt: number;
}

export interface Settings {
  lang: Lang;
  units: UnitSystem;
  /** Show metric volumes in decilitres (the Nordic habit) instead of millilitres. */
  useDl: boolean;
  theme: 'system' | 'light' | 'dark';
  /** Ingredients you always have at home; left unticked when adding to the grocery list. */
  pantry: string[];
  groceryView: 'aisle' | 'recipe';
  store: string;
  /** Look up current leaflet offers from Danish stores for the items in the cart. */
  offers: boolean;
  /** Limit offers to stores around the phone's rough position. */
  offersNearby: boolean;
  /** Show known ingredient names in the app's language, whatever language the recipe is in. */
  translateNames: boolean;
}
