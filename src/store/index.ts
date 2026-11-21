import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { SAMPLE_IMAGE_BY_TITLE, SAMPLES } from '@/data/samples';
import type { FamilyChange, FamilyInfo, FamilyMember } from '@/lib/familyTypes';
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
import { parseIngredient, parseIngredientLines, uid } from '@/lib/units';

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  units: 'original',
  useDl: false,
  theme: 'system',
  pantry: [],
  groceryView: 'aisle',
  store: 'auto',
  offers: false,
  offersNearby: false,
  translateNames: true,
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

export interface FamilyLink {
  code: string;
  name: string;
  memberId: string;
  memberName: string;
  members: FamilyMember[];
  /** How far into the family's change list this phone has caught up. */
  cursor: number;
  lastSync?: number;
}

const SAMPLE_TITLES = new Set(Object.values(SAMPLES).flatMap((list) => list.map((d) => d.title)));

/** A starter recipe nobody has edited. Every phone has its own copy, so these are never shared. */
export function isUntouchedSample(r: Recipe): boolean {
  return r.createdAt === r.updatedAt && SAMPLE_TITLES.has(r.title);
}

interface State {
  hydrated: boolean;
  /** False until the first-run language/pantry defaults and sample recipes are in place. */
  seeded: boolean;
  recipes: Recipe[];
  cookbooks: Cookbook[];
  plan: PlanEntry[];
  groceries: GroceryItem[];
  /** What the cook has at home, for "What can I cook?". */
  onHand: string[];
  settings: Settings;
  /** A recipe being imported or edited; handed from the importer to the editor. Not persisted. */
  draft: RecipeDraft | null;
  /** The family this phone shares recipes with, if any. */
  family: FamilyLink | null;
  /** Recipes changed here that the family has not received yet. */
  dirty: string[];
  /** Recipes deleted here that the family has not been told about yet. */
  tombstones: { id: string; at: number }[];
  /** Cart items changed or removed here that the family has not received yet. */
  cartDirty: string[];
  cartGone: { id: string; at: number }[];

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
  dropGroceries: (gone: (g: GroceryItem) => boolean) => void;

  setOnHand: (items: string[]) => void;
  joinFamily: (info: FamilyInfo, memberId: string, memberName: string, shareExisting: boolean) => void;
  leaveFamily: () => void;
  /** Records what a sync achieved: what was sent, what arrived, and how far we have caught up. */
  applyFamilySync: (r: { sent: { id: string; updatedAt: number }[]; sentDeletes: string[]; sentItems: { id: string; updatedAt: number }[]; changes: (FamilyChange & { image?: string })[]; cursor: number; family: FamilyInfo }) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setLanguage: (lang: Lang) => void;
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
      onHand: [],
      settings: DEFAULT_SETTINGS,
      draft: null,
      family: null,
      dirty: [],
      tombstones: [],
      cartDirty: [],
      cartGone: [],

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
          dirty: s.family && !s.dirty.includes(recipe.id) ? [...s.dirty, recipe.id] : s.dirty,
        }));
        return recipe;
      },

      deleteRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.filter((r) => r.id !== id),
          plan: s.plan.filter((p) => p.recipeId !== id),
          dirty: s.dirty.filter((x) => x !== id),
          tombstones: s.family ? [...s.tombstones.filter((x) => x.id !== id), { id, at: Date.now() }] : s.tombstones,
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
        set((s) => ({ recipes: [copy, ...s.recipes], dirty: s.family ? [...s.dirty, copy.id] : s.dirty }));
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
        const added = items.map((it, i) => ({ ...it, id: uid(), checked: false, createdAt: now + i, updatedAt: now + i }));
        set((s) => ({
          groceries: [...s.groceries, ...added],
          cartDirty: s.family ? [...s.cartDirty, ...added.map((g) => g.id)] : s.cartDirty,
        }));
      },

      setGroceriesChecked: (ids, checked) =>
        set((s) => {
          const now = Date.now();
          return {
            groceries: s.groceries.map((g) => (ids.includes(g.id) ? { ...g, checked, updatedAt: now } : g)),
            cartDirty: s.family ? [...new Set([...s.cartDirty, ...ids])] : s.cartDirty,
          };
        }),

      removeGroceries: (ids) => get().dropGroceries((g) => ids.includes(g.id)),
      clearChecked: () => get().dropGroceries((g) => g.checked),
      clearGroceries: () => get().dropGroceries(() => true),

      dropGroceries: (gone) =>
        set((s) => {
          const now = Date.now();
          const removed = s.groceries.filter(gone);
          return {
            groceries: s.groceries.filter((g) => !gone(g)),
            cartDirty: s.cartDirty.filter((id) => !removed.some((g) => g.id === id)),
            // Tell the family too, or the item would come straight back from someone else's phone.
            cartGone: s.family ? [...s.cartGone, ...removed.map((g) => ({ id: g.id, at: now }))] : s.cartGone,
          };
        }),

      setOnHand: (onHand) => set({ onHand: [...new Set(onHand)] }),

      joinFamily: (info, memberId, memberName, shareExisting) =>
        set((s) => ({
          family: { code: info.code, name: info.name, members: info.members, memberId, memberName, cursor: 0 },
          dirty: shareExisting ? s.recipes.filter((r) => !isUntouchedSample(r)).map((r) => r.id) : [],
          tombstones: [],
          cartDirty: shareExisting ? s.groceries.map((g) => g.id) : [],
          cartGone: [],
        })),

      // Leaving keeps every recipe on this phone; it only stops the exchange.
      leaveFamily: () => set({ family: null, dirty: [], tombstones: [], cartDirty: [], cartGone: [] }),

      applyFamilySync: ({ sent, sentDeletes, sentItems, changes, cursor, family }) =>
        set((s) => {
          if (!s.family) return {};
          let recipes = s.recipes;
          let plan = s.plan;
          let groceries = s.groceries;
          const stamp = (g: GroceryItem) => g.updatedAt ?? g.createdAt;
          for (const c of changes) {
            const inCart = groceries.find((g) => g.id === c.id);
            if (c.item) {
              if (inCart && stamp(inCart) >= c.updatedAt) continue;
              const item: GroceryItem = { ...c.item, id: c.id, updatedAt: c.updatedAt };
              groceries = inCart ? groceries.map((g) => (g.id === c.id ? item : g)) : [...groceries, item];
              continue;
            }
            if (c.deleted && inCart) {
              if (stamp(inCart) < c.updatedAt) groceries = groceries.filter((g) => g.id !== c.id);
              continue;
            }
            const local = recipes.find((r) => r.id === c.id);
            // Something newer on this phone that has not gone out yet wins over what arrived.
            if (local && local.updatedAt >= c.updatedAt) continue;
            if (c.deleted) {
              recipes = recipes.filter((r) => r.id !== c.id);
              plan = plan.filter((p) => p.recipeId !== c.id);
            } else if (c.recipe) {
              const merged: Recipe = {
                ...c.recipe,
                id: c.id,
                image: c.image ?? c.recipe.image,
                favorite: local?.favorite ?? false,
                cookbookIds: local?.cookbookIds ?? [],
                addedBy: c.by,
              };
              recipes = local ? recipes.map((r) => (r.id === c.id ? merged : r)) : [merged, ...recipes];
            }
          }
          // Only forget a pending change if the recipe was not edited again while the sync ran.
          const stillDirty = s.dirty.filter((id) => {
            const pushed = sent.find((x) => x.id === id);
            // Nothing to send for a recipe that no longer exists here.
            if (!pushed) return s.recipes.some((r) => r.id === id);
            const now = s.recipes.find((r) => r.id === id);
            return !!now && now.updatedAt !== pushed.updatedAt;
          });
          const cartDirty = s.cartDirty.filter((id) => {
            const pushed = sentItems.find((x) => x.id === id);
            const now = s.groceries.find((g) => g.id === id);
            if (!pushed) return !!now;
            return !!now && stamp(now) !== pushed.updatedAt;
          });
          return {
            recipes,
            plan,
            groceries,
            dirty: stillDirty,
            cartDirty,
            cartGone: s.cartGone.filter((x) => !sentDeletes.includes(x.id)),
            tombstones: s.tombstones.filter((x) => !sentDeletes.includes(x.id)),
            family: { ...s.family, name: family.name, members: family.members, cursor, lastSync: Date.now() },
          };
        }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setLanguage: (lang) =>
        set((s) => {
          // Starter recipes nobody has edited follow the app's language; everything else is the user's own text.
          const recipes = s.recipes.map((r) => {
            if (r.createdAt !== r.updatedAt) return r;
            for (const from of ['en', 'da', 'lt'] as const) {
              const i = SAMPLES[from].findIndex((d) => d.title === r.title);
              if (i >= 0 && from !== lang) return { ...draftToRecipe(SAMPLES[lang][i], r), updatedAt: r.createdAt };
            }
            return r;
          });
          // Carry the starter pantry over to the new language if it was never customised.
          const untouched = JSON.stringify(s.settings.pantry) === JSON.stringify(DEFAULT_PANTRY[s.settings.lang]);
          return { recipes, settings: { ...s.settings, lang, ...(untouched ? { pantry: DEFAULT_PANTRY[lang] } : {}) } };
        }),

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
          // Recipes restored from a backup are new to the family too.
          dirty: s.family ? [...new Set([...s.dirty, ...incoming.map((r) => r.id)])] : s.dirty,
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
        onHand: s.onHand,
        settings: s.settings,
        family: s.family,
        dirty: s.dirty,
        tombstones: s.tombstones,
        cartDirty: s.cartDirty,
        cartGone: s.cartGone,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        // Starter recipes saved before they had photos get theirs; anything the user gave a photo is left alone.
        const recipes = (p.recipes ?? current.recipes).map((r) => {
          const withPhoto = !r.image && SAMPLE_IMAGE_BY_TITLE[r.title] ? { ...r, image: SAMPLE_IMAGE_BY_TITLE[r.title] } : r;
          // Read amounts again for lines saved before the parser understood them (e.g. "Turmeric – 100 g"),
          // so older recipes scale too. Lines that already have an amount are not touched.
          const ingredients = withPhoto.ingredients.map((ing) => {
            if (ing.header || ing.qty !== undefined) return ing;
            const again = parseIngredient(ing.raw);
            return again.qty !== undefined && !again.header ? { ...again, id: ing.id } : ing;
          });
          return { ...withPhoto, ingredients };
        });
        return { ...current, ...p, recipes, onHand: Array.isArray(p.onHand) ? p.onHand : [], settings: { ...DEFAULT_SETTINGS, ...p.settings } };
      },
      onRehydrateStorage: () => (state) => {
        // `state` is missing when storage could not be read; the app must still open.
        if (state) state.setHydrated();
        else queueMicrotask(() => useStore.getState().setHydrated());
      },
    },
  ),
);
