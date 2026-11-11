import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddRecipeSheet, RecipeCard, matchesQuery } from '@/components/recipe-bits';
import { Btn, Chip, Empty, Header, IconBtn, Screen, Txt } from '@/components/ui';
import { useT, type Key } from '@/i18n';
import { MEAL_TYPES, type MealType, type Recipe } from '@/lib/types';
import { useStore } from '@/store';
import { MAX_WIDTH, radius, space, useColors } from '@/theme';

type Filter = 'all' | 'favorites' | MealType;

const QUICK_ADD: { key: string; mode?: 'link' | 'text' | 'photo'; icon: React.ComponentProps<typeof Ionicons>['name']; label: Key; a11y: Key }[] = [
  { key: 'link', mode: 'link', icon: 'link', label: 'quick_link', a11y: 'add_from_link' },
  { key: 'text', mode: 'text', icon: 'clipboard-outline', label: 'import_tab_text', a11y: 'add_from_text' },
  { key: 'photo', mode: 'photo', icon: 'camera-outline', label: 'import_tab_photo', a11y: 'add_from_photo' },
  { key: 'write', icon: 'create-outline', label: 'quick_write', a11y: 'add_manual' },
];

export default function RecipesScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const recipes = useStore((s) => s.recipes);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);

  const usedMeals = useMemo(() => MEAL_TYPES.filter((m) => recipes.some((r) => r.mealTypes.includes(m))), [recipes]);
  const list = useMemo(() => {
    return recipes.filter((r) => {
      if (filter === 'favorites' && !r.favorite) return false;
      if (filter !== 'all' && filter !== 'favorites' && !r.mealTypes.includes(filter)) return false;
      return matchesQuery(r, q);
    });
  }, [recipes, q, filter]);

  const columns = Math.min(width, MAX_WIDTH) >= 620 ? 3 : 2;
  // Pad the last row so cards keep their column width.
  const rows = useMemo(() => {
    const out: (Recipe | null)[] = [...list];
    while (out.length % columns !== 0) out.push(null);
    return out;
  }, [list, columns]);

  return (
    <Screen>
      <Header large title={t('recipes_title')} right={<IconBtn name="add-circle" size={30} color={c.primary} onPress={() => setAdding(true)} label={t('add_recipe')} />} />
      {recipes.length > 0 ? (
        <View style={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              backgroundColor: c.card,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: space.md,
            }}>
            <Ionicons name="search" size={18} color={c.sub} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('recipes_search')}
              placeholderTextColor={c.sub}
              accessibilityLabel={t('recipes_search')}
              autoCorrect={false}
              style={{ flex: 1, minHeight: 44, fontSize: 16, color: c.text }}
            />
            {q ? (
              <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel={t('clear')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={c.sub} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label={t('filter_all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label={t('favorites')} icon="heart" selected={filter === 'favorites'} onPress={() => setFilter('favorites')} />
            {usedMeals.map((m) => (
              <Chip key={m} label={t(`meal_${m}` as Key)} selected={filter === m} onPress={() => setFilter(filter === m ? 'all' : m)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        key={columns}
        data={rows}
        numColumns={columns}
        keyExtractor={(r, i) => r?.id ?? `pad-${i}`}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md, paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (item ? <RecipeCard recipe={item} /> : <View style={{ flex: 1 }} />)}
        ListHeaderComponent={
          // The ways to add a recipe, always in view at the top of the list rather than behind the + button.
          <View style={{ gap: space.sm }}>
            <Txt v="label">{t('add_recipe')}</Txt>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {QUICK_ADD.map((q) => (
                <Pressable
                  key={q.key}
                  onPress={() => {
                    if (q.mode) return router.push({ pathname: '/import', params: { mode: q.mode } });
                    useStore.getState().setDraft(null);
                    router.push('/recipe/edit');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t(q.a11y)}
                  testID={`quick-${q.key}`}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: space.md,
                    borderRadius: radius.lg,
                    backgroundColor: c.primarySoft,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <Ionicons name={q.icon} size={24} color={c.primary} />
                  <Txt v="small" color={c.text} numberOfLines={1} style={{ fontWeight: '700' }}>
                    {t(q.label)}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          recipes.length === 0 ? (
            <Empty icon="restaurant-outline" title={t('recipes_empty_title')} body={t('recipes_empty_body')}>
              <Btn title={t('add_recipe')} icon="add" onPress={() => setAdding(true)} />
            </Empty>
          ) : (
            <Empty icon="search-outline" title={t('recipes_none_found')} />
          )
        }
      />
      <AddRecipeSheet visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}
