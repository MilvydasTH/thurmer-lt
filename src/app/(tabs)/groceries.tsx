import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Card, Check, Empty, Header, IconBtn, MenuRow, Screen, Segmented, Sheet, Txt, confirm, toast } from '@/components/ui';
import { useLang, useT, type Key, type TFn } from '@/i18n';
import { itemLabel, manualGrocery, mergeGroceries, storesFor, type MergedItem } from '@/lib/grocery';
import { formatPrice, startsLater, storeCoverage, type Offer } from '@/lib/offers';
import { findOffers } from '@/lib/offersApi';
import { openUrl, shareText } from '@/lib/platform';
import { AISLES, type GroceryItem } from '@/lib/types';
import { useStore } from '@/store';
import { radius, space, useColors } from '@/theme';

function shortDate(t: TFn, iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${t('months_short').split('|')[d.getMonth()]}`;
}

function validity(t: TFn, o: Offer, now: number): string {
  if (startsLater(o, now)) return t('offers_from', { date: shortDate(t, o.runFrom) });
  const till = shortDate(t, o.runTill);
  return till ? t('offers_until', { date: till }) : '';
}

function offerLine(o: Offer): string {
  const per = o.unitPrice ? ` (${formatPrice(o.unitPrice.value, o.currency)}/${o.unitPrice.unit})` : '';
  return `${o.store} · ${formatPrice(o.price, o.currency)}${per}`;
}

export default function CartScreen() {
  const t = useT();
  const lang = useLang();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const groceries = useStore((s) => s.groceries);
  const view = useStore((s) => s.settings.groceryView);
  const useDl = useStore((s) => s.settings.useDl);
  const storeId = useStore((s) => s.settings.store);
  const offersOn = useStore((s) => s.settings.offers);
  const [line, setLine] = useState('');
  const [sheet, setSheet] = useState<null | 'menu' | 'order'>(null);
  const [offers, setOffers] = useState<Record<string, Offer[]>>({});
  const [offerState, setOfferState] = useState<'idle' | 'loading' | 'failed' | 'unconfigured'>('idle');
  const [offerItem, setOfferItem] = useState<MergedItem | null>(null);
  const [refresh, setRefresh] = useState(0);

  const merged = useMemo(() => mergeGroceries(groceries, lang, useDl), [groceries, lang, useDl]);
  const left = useMemo(() => merged.filter((m) => !m.checked), [merged]);
  const stores = storesFor(lang);
  const store = stores.find((s) => s.id === storeId) ?? stores[0];

  // Only look up what is still to buy, and only again when that set of items changes.
  const wanted = useMemo(() => left.map((m) => ({ key: m.key, name: m.name })), [left]);
  const wantedKey = wanted.map((w) => `${w.key}:${w.name}`).join('|');
  useEffect(() => {
    if (!offersOn || wanted.length === 0) {
      setOfferState('idle');
      return;
    }
    let live = true;
    setOfferState('loading');
    const timer = setTimeout(async () => {
      const res = await findOffers(wanted);
      if (!live) return;
      if (!res.ok) return setOfferState(res.error === 'not_configured' ? 'unconfigured' : 'failed');
      setOffers(res.byItem);
      setOfferState(res.failed && Object.keys(res.byItem).length === 0 ? 'failed' : 'idle');
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `wantedKey` stands in for `wanted`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offersOn, wantedKey, refresh]);

  const now = Date.now();
  const onOffer = left.filter((m) => (offers[m.key]?.length ?? 0) > 0);
  const coverage = useMemo(() => {
    const live: Record<string, Offer[]> = {};
    for (const m of left) if (offers[m.key]?.length) live[m.key] = offers[m.key];
    return storeCoverage(live).slice(0, 3);
  }, [left, offers]);

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
  const inCart = useMemo(() => {
    const seen = new Map<string, { id: string; title: string; ids: string[] }>();
    for (const g of groceries) {
      if (!g.recipeId || !g.recipeTitle) continue;
      const entry = seen.get(g.recipeId) ?? { id: g.recipeId, title: g.recipeTitle, ids: [] };
      entry.ids.push(g.id);
      seen.set(g.recipeId, entry);
    }
    return [...seen.values()];
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

  const row = (m: MergedItem, withOffer: boolean) => {
    const best = withOffer && !m.checked ? offers[m.key]?.[0] : undefined;
    return (
      <Check
        key={m.key}
        strike
        checked={m.checked}
        onPress={() => useStore.getState().setGroceriesChecked(m.ids, !m.checked)}
        label={[m.qtyText, m.name].filter(Boolean).join(' ')}
        sub={best ? offerLine(best) : m.recipes.length > 0 ? m.recipes.join(' · ') : undefined}
        subColor={best ? c.accent : undefined}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            {best ? (
              <Pressable onPress={() => setOfferItem(m)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('offers_show')} ${m.name}`}>
                <Ionicons name="pricetag" size={20} color={c.accent} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => useStore.getState().removeGroceries(m.ids)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('remove')} ${m.name}`}>
              <Ionicons name="close" size={18} color={c.sub} />
            </Pressable>
          </View>
        }
      />
    );
  };

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

        {inCart.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Txt v="label">{t('cart_recipes')}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {inCart.map((r) => (
                <View
                  key={r.id}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.chip, borderRadius: radius.pill, paddingLeft: space.md, maxWidth: '100%' }}>
                  <Pressable onPress={() => router.push(`/recipe/${r.id}`)} accessibilityRole="button" accessibilityLabel={r.title} style={{ paddingVertical: 8, flexShrink: 1 }}>
                    <Txt v="sub" color={c.text} numberOfLines={1} style={{ fontWeight: '600' }}>
                      {r.title}
                    </Txt>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      useStore.getState().removeGroceries(r.ids);
                      toast(t('cart_recipe_removed'));
                    }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('cart_remove_recipe', { name: r.title })}
                    style={{ padding: 8 }}>
                    <Ionicons name="close" size={16} color={c.sub} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {groceries.length > 0 ? (
          <Txt v="sub">{left.length === 0 ? t('groceries_all_done') : t('groceries_left', { n: left.length, total: merged.length })}</Txt>
        ) : null}

        {offersOn && left.length > 0 ? (
          <Card style={{ gap: 6, backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Ionicons name="pricetag" size={18} color={c.accent} />
              <Txt v="h3" style={{ flex: 1 }}>
                {t('offers_title')}
              </Txt>
              {offerState !== 'loading' ? (
                <Pressable onPress={() => setRefresh((n) => n + 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('offers_refresh')}>
                  <Ionicons name="refresh" size={18} color={c.sub} />
                </Pressable>
              ) : null}
            </View>
            {offerState === 'loading' ? (
              <Txt v="sub" color={c.text}>
                {t('offers_loading')}
              </Txt>
            ) : offerState === 'unconfigured' ? (
              <Txt v="sub" color={c.text}>
                {t('offers_unconfigured')}
              </Txt>
            ) : offerState === 'failed' ? (
              <Txt v="sub" color={c.danger} accessibilityRole="alert">
                {t('offers_error')}
              </Txt>
            ) : onOffer.length === 0 ? (
              <Txt v="sub" color={c.text}>
                {t('offers_none')}
              </Txt>
            ) : (
              <>
                <Txt v="sub" color={c.text} testID="offers-summary">
                  {t('offers_summary', { n: onOffer.length, total: left.length })}
                </Txt>
                {coverage.length > 0 ? (
                  <Txt v="sub" color={c.text}>
                    {t('offers_stores', { list: coverage.map((s) => `${s.store} (${s.items})`).join(', ') })}
                  </Txt>
                ) : null}
              </>
            )}
            <Txt v="small">{t('offers_source')}</Txt>
          </Card>
        ) : null}

        {view === 'aisle'
          ? byAisle.map((g) => (
              <Card key={g.aisle} style={{ paddingVertical: space.sm }}>
                <Txt v="label" style={{ marginTop: space.xs }}>
                  {t(`aisle_${g.aisle}` as Key)}
                </Txt>
                {g.items.map((m) => row(m, true))}
              </Card>
            ))
          : byRecipe.map(([title, items]) => (
              <Card key={title || '_manual'} style={{ paddingVertical: space.sm }}>
                <Txt v="label" style={{ marginTop: space.xs }}>
                  {title || t('groceries_manual')}
                </Txt>
                {items.map((it) =>
                  row({ key: it.id, name: itemLabel(it, lang), qtyText: '', ids: [it.id], checked: it.checked, aisle: it.aisle, recipes: [] }, false),
                )}
              </Card>
            ))}

        {!offersOn && left.length > 0 ? (
          <Btn variant="secondary" icon="pricetag-outline" title={t('offers_enable')} onPress={() => useStore.getState().updateSettings({ offers: true })} testID="offers-enable" />
        ) : null}
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

      <Sheet visible={offerItem !== null} onClose={() => setOfferItem(null)} title={offerItem ? t('offers_for', { name: offerItem.name }) : ''}>
        {(offerItem ? (offers[offerItem.key] ?? []) : []).map((o) => (
          <View key={o.id} style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.sm, alignItems: 'center' }}>
            {o.image ? (
              <Image source={{ uri: o.image }} style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: '#fff' }} contentFit="contain" accessibilityLabel={o.heading} />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="pricetag-outline" size={22} color={c.sub} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="label" color={c.accent}>
                {o.store}
              </Txt>
              <Txt v="h3" numberOfLines={2}>
                {o.heading}
              </Txt>
              {o.description ? (
                <Txt v="small" numberOfLines={2}>
                  {o.description}
                </Txt>
              ) : null}
              <Txt v="small">{validity(t, o, now)}</Txt>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Txt v="h2">{formatPrice(o.price, o.currency)}</Txt>
              {o.prePrice ? <Txt v="small">{t('offers_before', { price: formatPrice(o.prePrice, o.currency) })}</Txt> : null}
              {o.unitPrice ? (
                <Txt v="small">
                  {formatPrice(o.unitPrice.value, o.currency)}/{o.unitPrice.unit}
                </Txt>
              ) : null}
            </View>
          </View>
        ))}
        <Txt v="small">{t('offers_source')}</Txt>
      </Sheet>
    </Screen>
  );
}
