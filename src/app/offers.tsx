import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Card, Empty, Field, Header, Screen, Txt, toast } from '@/components/ui';
import { useT, type TFn } from '@/i18n';
import { manualGrocery } from '@/lib/grocery';
import { approximatePlace } from '@/lib/location';
import { formatPrice, startsLater, type Offer } from '@/lib/offers';
import { searchOffers } from '@/lib/offersApi';
import { useStore } from '@/store';
import { radius, space, useColors } from '@/theme';

function when(t: TFn, o: Offer, now: number): string {
  const day = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${t('months_short').split('|')[d.getMonth()]}`;
  };
  if (startsLater(o, now)) return t('offers_from', { date: day(o.runFrom) });
  const till = day(o.runTill);
  return till ? t('offers_until', { date: till }) : '';
}

/** "Tilbud": search this week's leaflet offers in Danish shops for anything, not just what is in the cart. */
export default function OffersScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const nearby = useStore((s) => s.settings.offersNearby);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'start' | 'loading' | 'done' | 'failed' | 'unconfigured'>('start');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [searched, setSearched] = useState('');
  const [now] = useState(() => Date.now());

  const run = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setState('loading');
    const near = nearby ? ((await approximatePlace()) ?? undefined) : undefined;
    const res = await searchOffers(q, near);
    setSearched(q);
    if (!res.ok) return setState(res.error === 'not_configured' ? 'unconfigured' : 'failed');
    setOffers(res.offers);
    setState('done');
  };

  const addToCart = (o: Offer) => {
    // The cart keeps what the shopper searched for, so it merges with the same ingredient from recipes.
    const item = manualGrocery(searched);
    if (!item) return;
    useStore.getState().addGroceries([item]);
    toast(t('added_to_groceries', { n: 1 }));
  };

  return (
    <Screen>
      <Header back title={t('offers_finder')} />
      <View style={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm }}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field
              placeholder={t('offers_finder_ph')}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={run}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel={t('offers_finder_ph')}
            />
          </View>
          <Btn title={t('offers_finder_go')} icon="search" onPress={run} loading={state === 'loading'} disabled={query.trim().length < 2} testID="offers-search" />
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md, paddingBottom: insets.bottom + space.xxl }}>
        {state === 'start' ? <Empty icon="pricetags-outline" title={t('offers_finder')} body={t('offers_finder_hint')} /> : null}
        {state === 'unconfigured' ? <Empty icon="key-outline" title={t('offers_finder')} body={t('offers_unconfigured')} /> : null}
        {state === 'failed' ? <Empty icon="cloud-offline-outline" title={t('offers_error')} /> : null}
        {state === 'done' && offers.length === 0 ? <Empty icon="pricetags-outline" title={t('offers_finder_none', { name: searched })} /> : null}

        {state === 'done' && offers.length > 0 ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Txt v="sub" style={{ flex: 1 }}>
                {t('offers_finder_count', { n: offers.length, name: searched })}
              </Txt>
              <Btn small variant="secondary" icon="cart-outline" title={t('add_to_groceries')} onPress={() => addToCart(offers[0])} />
            </View>
            {offers.map((o) => (
              <Card key={o.id} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                {o.image ? (
                  <Image source={{ uri: o.image }} style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: '#fff' }} contentFit="contain" accessibilityLabel={o.heading} />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="pricetag-outline" size={24} color={c.sub} />
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
                  <Txt v="small">{when(t, o, now)}</Txt>
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
              </Card>
            ))}
            <Txt v="small">{t('offers_source')}</Txt>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
