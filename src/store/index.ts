import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { SAMPLES } from '@/data/samples';
import type {
  Cookbook,
  GroceryItem,
  Lang,
  PlanEntry,
  Recipe,
  RecipeDraft,
  RecipeTranslation,
  Settings,
} from '@/lib/types';
import { parseIngredientLines, uid } from '@/lib/units';

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  units: 'original',
  useDl: false,
  theme: 'system',
  pantry: [],
  groceryView: 'aisle',
  store: 'auto',
  offers: false,
};

export const DEFAULT_PANTRY: Record<Lang, string[]> = {
  en: ['salt', 'pepper', 'water', 'oil'],
  da: ['salt', 'peber', 'vand', 'olie'],
  lt: ['druska', 'pipirai', 'vanduo', 'aliejus'],
};

export interface Backup {
  app: 'skanu';
  version: 1;
  exportedAt: string;
  recipes: Recipe[];
  cookbooks: Cookbook[];
  plan: PlanEntry[];
  groceries: GroceryItem[];
  settings?: Settings;
}

interface State {
  hydrated: boolean;
  /** False until the first-run language/pantry defaults and sample recipes are in place. */
  seeded: boolean;
  recipes: Recipe[];
  cookbooks: Cookbook[];
  plan: PlanEntry[];
  groceries: GroceryItem[];
  settings: Settings;
  /** A recipe being imported or edited; handed from the importer to the editor. Not persisted. */
  draft: RecipeDraft | null;

  setHydrated: () => void;
  firstRun: (lang: Lang) => void;
  addSamples: () => void;
  setDraft: (d: RecipeDraft | null) => void;
  saveDraft: (d: RecipeDraft) => Recipe;
  deleteRecipe: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setRecipeCookbooks: (id: string, cookbookIds: string[]) => void;
  setTranslation: (id: string, lang: Lang, tr: RecipeTranslation) => void;
  duplicateRecipe: (id: string, suffix: string) => string | undefined;

  addCookbook: (name: string, emoji: string) => string;
  updateCookbook: (id: string, patch: Partial<Pick<Cookbook, 'name' | 'emoji'>>) => void;
  deleteCookbook: (id: string) => void;

  addPlan: (e: Omit<PlanEntry, 'id'>) => void;
  removePlan: (id: string) => void;
  clearPlan: (dates: string[]) => void;

  addGroceries: (items: Omit<GroceryItem, 'id' | 'checked' | 'createdAt'>[]) => void;
  setGroceriesChecked: (ids: string[], checked: boolean) => void;
  removeGroceries: (ids: string[]) => void;
  clearChecked: () => void;
  clearGroceries: () => void;

  updateSettings: (patch: Partial<Settings>) => void;
  exportBackup: () => Backup;
  importBackup: (data: unknown) => number;
  resetAll: () => void;
}

export function draftToRecipe(d: RecipeDraft, existing?: Recipe): Recipe {
  const now = Date.now();
  const clean = (s?: string) => {
    const v = s?.trim();
    return v ? v : undefined;
  };
  return {
    id: existing?.id ?? uid(),
    title: d.title.trim(),
    description: clean(d.description),
    image: clean(d.image),
    sourceUrl: clean(d.sourceUrl),
    sourceName: clean(d.sourceName),
    lang: d.lang,
    servings: d.servings && d.servings > 0 ? Math.round(d.servings) : (existing?.servings ?? 2),
    prepMin: d.prepMin || undefined,
    cookMin: d.cookMin || undefined,
    ingredients: parseIngredientLines(d.ingredients),
    steps: d.steps.map((s) => s.trim()).filter(Boolean),
    tags: [...new Set((d.tags ?? []).map((t) => t.trim()).filter(Boolean))],
    mealTypes: d.mealTypes ?? [],
    cuisine: clean(d.cuisine),
    notes: clean(d.notes),
    nutrition: d.nutrition,
    favorite: existing?.favorite ?? false,
    cookbookIds: existing?.cookbookIds ?? [],
    // Editing the text invalidates stored translations.
    translations: undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function recipeToDraft(r: Recipe): RecipeDraft {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    image: r.image,
    sourceUrl: r.sourceUrl,
    sourceName: r.sourceName,
    lang: r.lang,
    servings: r.servings,
    prepMin: r.prepMin,
    cookMin: r.cookMin,
    ingredients: r.ingredients.map((i) => (i.header ? `${i.name}:` : i.raw)),
    steps: r.steps,
    tags: r.tags,
    mealTypes: r.mealTypes,
    cuisine: r.cuisine,
    notes: r.notes,
    nutrition: r.nutrition,
  };
}

const noopStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const isRecipe = (r: unknown): r is Recipe =>
  !!r && typeof r === 'object' && typeof (r as Recipe).id === 'string' && typeof (r as Recipe).title === 'string' &&
  Array.isArray((r as Recipe).ingredients) && Array.isArray((r as Recipe).steps);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      seeded: false,
      recipes: [],
      cookbooks: [],
      plan: [],
      groceries: [],
      settings: DEFAULT_SETTINGS,
      draft: null,

      setHydrated: () => set({ hydrated: true }),

      firstRun: (lang) => {
        if (get().seeded) return;
        set((s) => ({
          seeded: true,
          settings: {
            ...s.settings,
            lang,
            // Metric with decilitres is what Danish cooks expect; plain metric for Lithuanian.
            units: lang === 'en' ? 'original' : 'metric',
            useDl: lang === 'da',
            pantry: DEFAULT_PANTRY[lang],
            // The offers are Danish, so they start switched on only for Danish devices.
            offers: lang === 'da',
          },
        }));
        if (get().recipes.length === 0) get().addSamples();
      },

      addSamples: () => {
        const lang = get().settings.lang;
        const now = Date.now();
        const samples = SAMPLES[lang].map((d, i) => ({ ...draftToRecipe(d), createdAt: now - i, updatedAt: now - i }));
        set((s) => ({ recipes: [...samples, ...s.recipes] }));
      },

      setDraft: (draft) => set({ draft }),

      saveDraft: (d) => {
        const existing = d.id ? get().recipes.find((r) => r.id === d.id) : undefined;
        const recipe = draftToRecipe(d, existing);
        set((s) => ({
          recipes: existing ? s.recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [recipe, ...s.recipes],
        }));
        return recipe;
      },

      deleteRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.filter((r) => r.id !== id),
          plan: s.plan.filter((p) => p.recipeId !== id),
        })),

      toggleFavorite: (id) =>
        set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)) })),

      setRecipeCookbooks: (id, cookbookIds) =>
        set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, cookbookIds } : r)) })),

      setTranslation: (id, lang, tr) =>
        set((s) => ({
          recipes: s.recipes.map((r) => (r.id === id ? { ...r, translations: { ...r.translations, [lang]: tr } } : r)),
        })),

      duplicateRecipe: (id, suffix) => {
        const src = get().recipes.find((r) => r.id === id);
        if (!src) return undefined;
        const now = Date.now();
        const copy: Recipe = { ...src, id: uid(), title: `${src.title} ${suffix}`, favorite: false, createdAt: now, updatedAt: now };
        set((s) => ({ recipes: [copy, ...s.recipes] }));
        return copy.id;
      },

      addCookbook: (name, emoji) => {
        const id = uid();
        set((s) => ({ cookbooks: [...s.cookbooks, { id, name: name.trim(), emoji, createdAt: Date.now() }] }));
        return id;
      },

      updateCookbook: (id, patch) =>
        set((s) => ({ cookbooks: s.cookbooks.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      deleteCookbook: (id) =>
        set((s) => ({
          cookbooks: s.cookbooks.filter((c) => c.id !== id),
          recipes: s.recipes.map((r) =>
            r.cookbookIds.includes(id) ? { ...r, cookbookIds: r.cookbookIds.filter((c) => c !== id) } : r,
          ),
        })),

      addPlan: (e) => set((s) => ({ plan: [...s.plan, { ...e, id: uid() }] })),
      removePlan: (id) => set((s) => ({ plan: s.plan.filter((p) => p.id !== id) })),
      clearPlan: (dates) => set((s) => ({ plan: s.plan.filter((p) => !dates.includes(p.date)) })),

      addGroceries: (items) => {
        const now = Date.now();
        set((s) => ({
          groceries: [...s.groceries, ...items.map((it, i) => ({ ...it, id: uid(), checked: false, createdAt: now + i }))],
        }));
      },

      setGroceriesChecked: (ids, checked) =>
        set((s) => ({ groceries: s.groceries.map((g) => (ids.includes(g.id) ? { ...g, checked } : g)) })),

      removeGroceries: (ids) => set((s) => ({ groceries: s.groceries.filter((g) => !ids.includes(g.id)) })),
      clearChecked: () => set((s) => ({ groceries: s.groceries.filter((g) => !g.checked) })),
      clearGroceries: () => set({ groceries: [] }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      exportBackup: () => {
        const s = get();
        return {
          app: 'skanu',
          version: 1,
          exportedAt: new Date().toISOString(),
          recipes: s.recipes,
          cookbooks: s.cookbooks,
          plan: s.plan,
          groceries: s.groceries,
          settings: s.settings,
        };
      },

      /** Merges a backup into the library. Existing recipes with the same id are replaced. Returns recipes imported. */
      importBackup: (data) => {
        const b = data as Partial<Backup> | null;
        if (!b || typeof b !== 'object' || !Array.isArray(b.recipes)) throw new Error('invalid');
        const incoming = b.recipes.filter(isRecipe).map((r) => ({
          ...r,
          favorite: !!r.favorite,
          tags: Array.isArray(r.tags) ? r.tags : [],
          mealTypes: Array.isArray(r.mealTypes) ? r.mealTypes : [],
          cookbookIds: Array.isArray(r.cookbookIds) ? r.cookbookIds : [],
          servings: r.servings > 0 ? r.servings : 2,
        }));
        const ids = new Set(incoming.map((r) => r.id));
        const books = Array.isArray(b.cookbooks) ? b.cookbooks.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string') : [];
        const bookIds = new Set(books.map((c) => c.id));
        const plan = Array.isArray(b.plan) ? b.plan.filter((p) => p && typeof p.id === 'string' && typeof p.date === 'string') : [];
        const planIds = new Set(plan.map((p) => p.id));
        set((s) => ({
          recipes: [...incoming, ...s.recipes.filter((r) => !ids.has(r.id))],
          cookbooks: [...s.cookbooks.filter((c) => !bookIds.has(c.id)), ...books],
          plan: [...s.plan.filter((p) => !planIds.has(p.id)), ...plan],
        }));
        return incoming.length;
      },

      resetAll: () =>
        set((s) => ({ recipes: [], cookbooks: [], plan: [], groceries: [], settings: { ...s.settings, pantry: DEFAULT_PANTRY[s.settings.lang] } })),
    }),
    {
      name: 'skanu-v1',
      version: 1,
      storage: createJSONStorage(() => (typeof window === 'undefined' ? noopStorage : AsyncStorage)),
      partialize: (s) => ({
        seeded: s.seeded,
        recipes: s.recipes,
        cookbooks: s.cookbooks,
        plan: s.plan,
        groceries: s.groceries,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
      },
      onRehydrateStorage: () => (state) => {
        // `state` is missing when storage could not be read; the app must still open.
        if (state) state.setHydrated();
        else queueMicrotask(() => useStore.getState().setHydrated());
      },
    },
  ),
);
