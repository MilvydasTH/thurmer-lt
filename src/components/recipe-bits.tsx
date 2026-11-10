import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { minutesLabel, useT } from '@/i18n';
import type { Recipe } from '@/lib/types';
import { useStore } from '@/store';
import { radius, space, useColors } from '@/theme';

import { Check, Empty, Field, MenuRow, RecipeImage, Sheet, Txt } from './ui';

export function totalMinutes(r: Pick<Recipe, 'prepMin' | 'cookMin'>): number {
  return (r.prepMin ?? 0) + (r.cookMin ?? 0);
}

export function matchesQuery(r: Recipe, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [r.title, r.description, r.cuisine, r.sourceName, ...r.tags, ...r.ingredients.map((i) => i.name)]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return needle.split(/\s+/).every((word) => hay.includes(word));
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const c = useColors();
  const t = useT();
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const mins = totalMinutes(recipe);
  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
      <Pressable
        onPress={() => router.push(`/recipe/${recipe.id}`)}
        accessibilityRole="button"
        accessibilityLabel={recipe.title}
        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
        <RecipeImage uri={recipe.image} title={recipe.title} style={{ width: '100%', aspectRatio: 4 / 3 }} />
        <View style={{ padding: space.md, gap: 4 }}>
          <Txt v="h3" numberOfLines={2}>
            {recipe.title}
          </Txt>
          <Txt v="small" numberOfLines={1}>
            {[mins ? minutesLabel(t, mins) : null, `${recipe.ingredients.filter((i) => !i.header).length} ${t('ingredients_short')}`]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </View>
      </Pressable>
      {/* A sibling, not a child: a button inside a button is invalid on web and confuses screen readers. */}
      <Pressable
        onPress={() => toggleFavorite(recipe.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t(recipe.favorite ? 'unfavorite' : 'favorite')}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: c.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={recipe.favorite ? 'heart' : 'heart-outline'} size={18} color={recipe.favorite ? c.primary : c.sub} />
      </Pressable>
    </View>
  );
}

export function RecipeRow({ recipe, onPress, right }: { recipe: Recipe; onPress?: () => void; right?: React.ReactNode }) {
  const t = useT();
  const mins = totalMinutes(recipe);
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/recipe/${recipe.id}`))}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}>
      <RecipeImage uri={recipe.image} title={recipe.title} iconSize={20} style={{ width: 56, height: 56, borderRadius: radius.md }} />
      <View style={{ flex: 1 }}>
        <Txt v="h3" numberOfLines={2}>
          {recipe.title}
        </Txt>
        <Txt v="small" numberOfLines={1}>
          {[mins ? minutesLabel(t, mins) : null, recipe.cuisine, recipe.sourceName].filter(Boolean).join(' · ')}
        </Txt>
      </View>
      {right}
    </Pressable>
  );
}

/** The "add a recipe" menu, shared by the recipes tab and empty states. */
export function AddRecipeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const setDraft = useStore((s) => s.setDraft);
  const go = (mode: 'link' | 'text' | 'photo') => {
    onClose();
    router.push({ pathname: '/import', params: { mode } });
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('add_recipe')}>
      <MenuRow icon="link" title={t('add_from_link')} sub={t('add_from_link_sub')} onPress={() => go('link')} />
      <MenuRow icon="clipboard-outline" title={t('add_from_text')} sub={t('add_from_text_sub')} onPress={() => go('text')} />
      <MenuRow icon="camera-outline" title={t('add_from_photo')} sub={t('add_from_photo_sub')} onPress={() => go('photo')} />
      <MenuRow
        icon="create-outline"
        title={t('add_manual')}
        sub={t('add_manual_sub')}
        onPress={() => {
          onClose();
          setDraft(null);
          router.push('/recipe/edit');
        }}
      />
    </Sheet>
  );
}

/** Searchable list of the library; single tap picks, or multi-select with checkboxes. */
export function RecipePicker({
  visible,
  onClose,
  title,
  onPick,
  selected,
  onToggle,
  header,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  onPick?: (r: Recipe) => void;
  selected?: string[];
  onToggle?: (r: Recipe) => void;
  header?: React.ReactNode;
}) {
  const t = useT();
  const recipes = useStore((s) => s.recipes);
  const [q, setQ] = useState('');
  const list = useMemo(() => recipes.filter((r) => matchesQuery(r, q)), [recipes, q]);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {header}
      {recipes.length > 6 ? <Field placeholder={t('recipes_search')} value={q} onChangeText={setQ} autoCorrect={false} /> : null}
      {recipes.length === 0 ? <Empty icon="restaurant-outline" title={t('recipes_empty_title')} body={t('recipes_empty_body')} /> : null}
      {list.map((r) =>
        onToggle ? (
          <Check key={r.id} checked={!!selected?.includes(r.id)} onPress={() => onToggle(r)} label={r.title} />
        ) : (
          <RecipeRow key={r.id} recipe={r} onPress={() => onPick?.(r)} />
        ),
      )}
    </Sheet>
  );
}
