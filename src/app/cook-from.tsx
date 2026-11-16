import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeRow } from '@/components/recipe-bits';
import { Btn, Card, Chip, Empty, Field, Header, Screen, Txt, toast } from '@/components/ui';
import { useLang, useT } from '@/i18n';
import { ingredientToGrocery } from '@/lib/grocery';
import { approximatePlace } from '@/lib/location';
import { findOffers } from '@/lib/offersApi';
import { cookFrom, libraryFoods, onHandKey, rankByOffers } from '@/lib/suggest';
import { foodName } from '@/lib/translateName';
import type { Recipe } from '@/lib/types';
import { useStore } from '@/store';
import { space, useColors } from '@/theme';

/**
 * "What can I cook?": the cook lists what is at home and sees which of their own recipes that
 * covers, with what is still missing. A second section does the same from this week's store
 * offers, so the plan can follow the discounts.
 */
export default function CookFromScreen() {
  const t = useT();
  const lang = useLang();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const recipes = useStore((s) => s.recipes);
  const onHand = useStore((s) => s.onHand);
  const pantry = useStore((s) => s.settings.pantry);
  const nearby = useStore((s) => s.settings.offersNearby);
  const setOnHand = useStore((s) => s.setOnHand);
  const [text, setText] = useState('');
  const [offerState, setOfferState] = useState<'idle' | 'loading' | 'done' | 'failed' | 'unconfigured'>('idle');
  const [onOffer, setOnOffer] = useState<Set<string>>(new Set());

  const label = (key: string) => (key.startsWith('f:') ? (foodName(key.slice(2), lang, { measured: false }) ?? key.slice(2)) : key.slice(2));
  const matches = useMemo(() => cookFrom(recipes, onHand, pantry), [recipes, onHand, pantry]);
  const common = useMemo(
    () => libraryFoods(recipes, pantry, 14).map((f) => `f:${f.id}`).filter((k) => !onHand.includes(k)),
    [recipes, pantry, onHand],
  );
  const byOffer = useMemo(() => rankByOffers(recipes, onOffer), [recipes, onOffer]);

  const add = () => {
    // Several at once is the natural way to type a fridge: "eggs, milk, half a cabbage".
    const keys = text.split(/[,;\n]/).map((x) => onHandKey(x)).filter((k): k is string => !!k);
    if (keys.length) setOnHand([...onHand, ...keys]);
    setText('');
  };

  const addMissing = (recipe: Recipe, missing: { name: string }[]) => {
    const items = recipe.ingredients.filter((i) => missing.some((m) => m.name === i.name)).map((i) => ingredientToGrocery(i, 1, recipe));
    useStore.getState().addGroceries(items);
    toast(t('added_to_groceries', { n: items.length }));
  };

  const loadOffers = async () => {
    const foods = libraryFoods(recipes, pantry);
    if (foods.length === 0) return;
    setOfferState('loading');
    const near = nearby ? ((await approximatePlace()) ?? undefined) : undefined;
    const res = await findOffers(foods.map((f) => ({ key: f.id, name: f.da })), near);
    if (!res.ok) return setOfferState(res.error === 'not_configured' ? 'unconfigured' : 'failed');
    setOnOffer(new Set(Object.entries(res.byItem).filter(([, offers]) => offers.length > 0).map(([id]) => id)));
    setOfferState('done');
  };

  return (
    <Screen>
      <Header back title={t('cookfrom_title')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        <View style={{ gap: space.sm }}>
          <Txt v="label">{t('cookfrom_have')}</Txt>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field placeholder={t('cookfrom_ph')} value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done" autoCapitalize="none" accessibilityLabel={t('cookfrom_ph')} />
            </View>
            <Btn title={t('add')} onPress={add} disabled={!text.trim()} testID="onhand-add" />
          </View>
          {onHand.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {onHand.map((k) => (
                <Chip key={k} label={`${label(k)}  ✕`} selected onPress={() => setOnHand(onHand.filter((x) => x !== k))} />
              ))}
            </View>
          ) : null}
          {common.length > 0 ? (
            <>
              <Txt v="small">{t('cookfrom_common')}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {common.map((k) => (
                  <Chip key={k} label={label(k)} icon="add" onPress={() => setOnHand([...onHand, k])} />
                ))}
              </View>
            </>
          ) : null}
        </View>

        {onHand.length === 0 ? <Empty icon="basket-outline" title={t('cookfrom_title')} body={t('cookfrom_none')} /> : null}
        {onHand.length > 0 && matches.length === 0 ? <Txt v="sub">{t('cookfrom_nomatch')}</Txt> : null}

        {matches.map((m) => (
          <Card key={m.recipe.id} style={{ gap: space.sm }}>
            <RecipeRow recipe={m.recipe} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={m.missing.length === 0 ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={m.missing.length === 0 ? c.accent : c.sub} />
              <Txt v="sub" color={m.missing.length === 0 ? c.accent : undefined} style={{ flex: 1 }}>
                {m.missing.length === 0 ? t('cookfrom_all') : t('cookfrom_have_count', { n: m.have, total: m.total })}
              </Txt>
            </View>
            {m.missing.length > 0 ? (
              <>
                <Txt v="small">{t('cookfrom_missing', { list: m.missing.map((i) => i.name).join(', ') })}</Txt>
                <Btn small variant="secondary" icon="cart-outline" title={t('cookfrom_add_missing')} onPress={() => addMissing(m.recipe, m.missing)} />
              </>
            ) : null}
          </Card>
        ))}

        <View style={{ gap: space.sm }}>
          <Txt v="label">{t('cookfrom_offers_title')}</Txt>
          <Txt v="small">{t('cookfrom_offers_help')}</Txt>
          <Btn variant="secondary" icon="pricetags-outline" title={t('cookfrom_offers_find')} onPress={loadOffers} loading={offerState === 'loading'} disabled={recipes.length === 0} testID="cookfrom-offers" />
          {offerState === 'unconfigured' ? <Txt v="sub">{t('offers_unconfigured')}</Txt> : null}
          {offerState === 'failed' ? (
            <Txt v="sub" color={c.danger} accessibilityRole="alert">
              {t('offers_error')}
            </Txt>
          ) : null}
          {offerState === 'done' && byOffer.length === 0 ? <Txt v="sub">{t('cookfrom_offers_none')}</Txt> : null}
          {offerState === 'done'
            ? byOffer.slice(0, 12).map((r) => (
                <Card key={r.recipe.id} style={{ gap: 4 }}>
                  <RecipeRow recipe={r.recipe} />
                  <Txt v="small" color={c.accent}>
                    {t('cookfrom_offers_count', { n: r.foods.length, list: r.foods.map((id) => foodName(id, lang, { measured: false }) ?? id).join(', ') })}
                  </Txt>
                </Card>
              ))
            : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
