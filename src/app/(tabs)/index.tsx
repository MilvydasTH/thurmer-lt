import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddRecipeSheet, RecipeCard, matchesQuery } from '@/components/recipe-bits';
import { Btn, Chip, Empty, Header, IconBtn, Screen } from '@/components/ui';
import { useT, type Key } from '@/i18n';
import { MEAL_TYPES, type MealType, type Recipe } from '@/lib/types';
import { useStore } from '@/store';
import { MAX_WIDTH, radius, space, useColors } from '@/theme';

type Filter = 'all' | 'favorites' | MealType;

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
