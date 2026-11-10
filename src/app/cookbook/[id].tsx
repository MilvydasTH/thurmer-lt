import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipePicker, RecipeRow } from '@/components/recipe-bits';
import { CookbookFormSheet } from '@/components/recipe-sheets';
import { Btn, Empty, Header, IconBtn, MenuRow, Screen, Sheet, confirm } from '@/components/ui';
import { useT } from '@/i18n';
import { useStore } from '@/store';
import { space } from '@/theme';

export default function CookbookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const isFavorites = id === 'favorites';
  const book = useStore((s) => s.cookbooks.find((b) => b.id === id));
  const recipes = useStore((s) => s.recipes);
  const setRecipeCookbooks = useStore((s) => s.setRecipeCookbooks);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const [sheet, setSheet] = useState<null | 'menu' | 'pick' | 'rename'>(null);

  const list = useMemo(
    () => recipes.filter((r) => (isFavorites ? r.favorite : r.cookbookIds.includes(id))),
    [recipes, id, isFavorites],
  );

  if (!isFavorites && !book) {
    return (
      <Screen>
        <Header back />
        <Empty icon="alert-circle-outline" title={t('cookbook_not_found')} />
      </Screen>
    );
  }

  const remove = async () => {
    setSheet(null);
    if (!(await confirm(t('cookbook_delete_q'), t('cookbook_delete_body'), t('delete'), t('cancel')))) return;
    router.back();
    useStore.getState().deleteCookbook(id);
  };

  return (
    <Screen>
      <Header
        back
        title={isFavorites ? `❤️  ${t('favorites')}` : `${book!.emoji}  ${book!.name}`}
        right={
          <>
            <IconBtn name="add" label={t('cookbook_add_recipes')} onPress={() => setSheet('pick')} />
            {!isFavorites ? <IconBtn name="ellipsis-horizontal" label={t('more')} onPress={() => setSheet('menu')} /> : null}
          </>
        }
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.xxl }}>
        {list.map((r) => (
          <RecipeRow key={r.id} recipe={r} />
        ))}
        {list.length === 0 ? (
          <Empty icon="book-outline" title={t('cookbook_empty')}>
            <Btn title={t('cookbook_add_recipes')} icon="add" onPress={() => setSheet('pick')} />
          </Empty>
        ) : null}
      </ScrollView>

      <RecipePicker
        visible={sheet === 'pick'}
        onClose={() => setSheet(null)}
        title={t('cookbook_add_recipes')}
        selected={list.map((r) => r.id)}
        onToggle={(r) => {
          if (isFavorites) toggleFavorite(r.id);
          else setRecipeCookbooks(r.id, r.cookbookIds.includes(id) ? r.cookbookIds.filter((x) => x !== id) : [...r.cookbookIds, id]);
        }}
      />
      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={book?.name}>
        <MenuRow icon="create-outline" title={t('cookbook_rename')} onPress={() => setSheet('rename')} />
        <MenuRow icon="trash-outline" title={t('delete')} danger onPress={remove} />
      </Sheet>
      <CookbookFormSheet visible={sheet === 'rename'} onClose={() => setSheet(null)} cookbookId={book?.id} />
    </Screen>
  );
}
