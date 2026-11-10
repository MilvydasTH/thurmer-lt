import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Card, Check, Empty, Header, IconBtn, MenuRow, Screen, Segmented, Sheet, Txt, confirm, toast } from '@/components/ui';
import { useLang, useT, type Key } from '@/i18n';
import { itemLabel, manualGrocery, mergeGroceries, storesFor, type MergedItem } from '@/lib/grocery';
import { openUrl, shareText } from '@/lib/platform';
import { AISLES, type GroceryItem } from '@/lib/types';
import { useStore } from '@/store';
import { radius, space, useColors } from '@/theme';

export default function GroceriesScreen() {
  const t = useT();
  const lang = useLang();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const groceries = useStore((s) => s.groceries);
  const view = useStore((s) => s.settings.groceryView);
  const useDl = useStore((s) => s.settings.useDl);
  const storeId = useStore((s) => s.settings.store);
  const [line, setLine] = useState('');
  const [sheet, setSheet] = useState<null | 'menu' | 'order'>(null);

  const merged = useMemo(() => mergeGroceries(groceries, lang, useDl), [groceries, lang, useDl]);
  const left = merged.filter((m) => !m.checked);
  const stores = storesFor(lang);
  const store = stores.find((s) => s.id === storeId) ?? stores[0];

  const byAisle = useMemo(
    () => AISLES.map((a) => ({ aisle: a, items: merged.filter((m) => m.aisle === a) })).filter((g) => g.items.length > 0),
    [merged],
  );
  const byRecipe = useMemo(() => {
    const groups = new Map<string, GroceryItem[]>();
    for (const g of groceries) {
      const key = g.recipeTitle ?? '';
      groups.set(key, [...(groups.get(key) ?? []), g]);
    }
    return [...groups.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])));
  }, [groceries]);

  const add = () => {
    const item = manualGrocery(line);
    if (!item) return;
    useStore.getState().addGroceries([item]);
    setLine('');
  };

  const listText = () =>
    byAisle
      .map((g) => `${t(`aisle_${g.aisle}` as Key)}\n${g.items.filter((i) => !i.checked).map((i) => `☐ ${[i.qtyText, i.name].filter(Boolean).join(' ')}`).join('\n')}`)
      .filter((block) => block.includes('☐'))
      .join('\n\n');

  const share = async () => {
    setSheet(null);
    const result = await shareText(listText(), t('groceries_title'));
    if (result === 'copied') toast(t('copied'));
  };

  const setChecked = (ids: string[], checked: boolean) => useStore.getState().setGroceriesChecked(ids, checked);

  const Row = ({ m }: { m: MergedItem }) => (
    <Check
      strike
      checked={m.checked}
      onPress={() => setChecked(m.ids, !m.checked)}
      label={[m.qtyText, m.name].filter(Boolean).join(' ')}
      sub={m.recipes.length > 0 ? m.recipes.join(' · ') : undefined}
      right={
        <Pressable onPress={() => useStore.getState().removeGroceries(m.ids)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('remove')} ${m.name}`}>
          <Ionicons name="close" size={18} color={c.sub} />
        </Pressable>
      }
    />
  );

  return (
    <Screen>
      <Header
        large
        title={t('groceries_title')}
        right={groceries.length > 0 ? <IconBtn name="ellipsis-horizontal" label={t('more')} onPress={() => setSheet('menu')} /> : null}
      />
      <View style={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            value={line}
            onChangeText={setLine}
            onSubmitEditing={add}
            placeholder={t('groceries_add_ph')}
            placeholderTextColor={c.sub}
            accessibilityLabel={t('groceries_add_ph')}
            returnKeyType="done"
            submitBehavior="submit"
            style={{
              flex: 1,
              minHeight: 46,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              fontSize: 16,
              color: c.text,
            }}
          />
          <Btn title={t('add')} onPress={add} disabled={!line.trim()} testID="grocery-add" />
        </View>
        {groceries.length > 0 ? (
          <Segmented
            value={view}
            onChange={(v) => useStore.getState().updateSettings({ groceryView: v })}
            options={[
              { value: 'aisle', label: t('groceries_by_aisle') },
              { value: 'recipe', label: t('groceries_by_recipe') },
            ]}
          />
        ) : null}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md, paddingBottom: insets.bottom + space.xxl }}>
        {groceries.length === 0 ? <Empty icon="cart-outline" title={t('groceries_empty_title')} body={t('groceries_empty_body')} /> : null}

        {groceries.length > 0 ? (
          <Txt v="sub">{left.length === 0 ? t('groceries_all_done') : t('groceries_left', { n: left.length, total: merged.length })}</Txt>
        ) : null}

        {view === 'aisle'
          ? byAisle.map((g) => (
              <Card key={g.aisle} style={{ paddingVertical: space.sm }}>
                <Txt v="label" style={{ marginTop: space.xs }}>
                  {t(`aisle_${g.aisle}` as Key)}
                </Txt>
                {g.items.map((m) => (
                  <Row key={m.key} m={m} />
                ))}
              </Card>
            ))
          : byRecipe.map(([title, items]) => (
              <Card key={title || '_manual'} style={{ paddingVertical: space.sm }}>
                <Txt v="label" style={{ marginTop: space.xs }}>
                  {title || t('groceries_manual')}
                </Txt>
                {items.map((it) => (
                  <Row
                    key={it.id}
                    m={{ key: it.id, name: itemLabel(it, lang), qtyText: '', ids: [it.id], checked: it.checked, aisle: it.aisle, recipes: [] }}
                  />
                ))}
              </Card>
            ))}

        {left.length > 0 ? <Btn variant="secondary" icon="bag-handle-outline" title={t('groceries_order')} onPress={() => setSheet('order')} /> : null}
        {merged.some((m) => m.checked) ? <Btn variant="ghost" title={t('groceries_clear_checked')} onPress={() => useStore.getState().clearChecked()} /> : null}
      </ScrollView>

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={t('groceries_title')}>
        <MenuRow icon="share-outline" title={t('groceries_share')} onPress={share} />
        <MenuRow
          icon="checkmark-done-outline"
          title={t('groceries_clear_checked')}
          onPress={() => {
            useStore.getState().clearChecked();
            setSheet(null);
          }}
        />
        <MenuRow
          icon="trash-outline"
          danger
          title={t('groceries_clear_all')}
          onPress={async () => {
            setSheet(null);
            if (await confirm(t('groceries_clear_all'), t('groceries_clear_all_q'), t('clear'), t('cancel'))) useStore.getState().clearGroceries();
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'order'} onClose={() => setSheet(null)} title={t('groceries_order')}>
        <Txt v="sub">{t('groceries_order_body')}</Txt>
        <Segmented value={store.id} onChange={(v) => useStore.getState().updateSettings({ store: v })} options={stores.map((s) => ({ value: s.id, label: s.name }))} />
        {left.map((m) => (
          <MenuRow key={m.key} icon="search" title={m.name} sub={m.qtyText || undefined} onPress={() => openUrl(store.search(m.name))} />
        ))}
      </Sheet>
    </Screen>
  );
}
