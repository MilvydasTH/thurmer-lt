import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CookbookFormSheet } from '@/components/recipe-sheets';
import { Btn, Card, Empty, Header, IconBtn, Screen, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { useStore } from '@/store';
import { space, useColors } from '@/theme';

function BookCard({ emoji, name, count, onPress }: { emoji: string; name: string; count: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text style={{ fontSize: 30 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Txt v="h3" numberOfLines={1}>
          {name}
        </Txt>
        <Txt v="small">{count}</Txt>
      </View>
    </Card>
  );
}

export default function CookbooksScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const cookbooks = useStore((s) => s.cookbooks);
  const recipes = useStore((s) => s.recipes);
  const [creating, setCreating] = useState(false);
  const favorites = recipes.filter((r) => r.favorite).length;

  return (
    <Screen>
      <Header large title={t('cookbooks_title')} right={<IconBtn name="add-circle" size={30} color={c.primary} label={t('cookbook_new')} onPress={() => setCreating(true)} />} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xxl }}>
        <BookCard emoji="❤️" name={t('favorites')} count={t('recipes_count', { n: favorites })} onPress={() => router.push('/cookbook/favorites')} />
        {cookbooks.map((b) => (
          <BookCard
            key={b.id}
            emoji={b.emoji}
            name={b.name}
            count={t('recipes_count', { n: recipes.filter((r) => r.cookbookIds.includes(b.id)).length })}
            onPress={() => router.push(`/cookbook/${b.id}`)}
          />
        ))}
        {cookbooks.length === 0 ? (
          <Empty icon="book-outline" title={t('cookbooks_empty_title')} body={t('cookbooks_empty_body')}>
            <Btn title={t('cookbook_new')} icon="add" onPress={() => setCreating(true)} testID="new-cookbook" />
          </Empty>
        ) : null}
      </ScrollView>
      <CookbookFormSheet visible={creating} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/cookbook/${id}`)} />
    </Screen>
  );
}
