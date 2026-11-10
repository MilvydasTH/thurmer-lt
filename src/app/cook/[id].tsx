import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Empty, Header, IconBtn, Screen, Sheet, Txt, toast } from '@/components/ui';
import { useLang, useT } from '@/i18n';
import { convertTemperatures, displayIngredient } from '@/lib/convert';
import { findTimers, formatClock } from '@/lib/timers';
import type { Lang, UnitSystem } from '@/lib/types';
import { parseIngredient } from '@/lib/units';
import { useStore } from '@/store';
import { radius, space, useColors } from '@/theme';

interface RunningTimer {
  id: string;
  label: string;
  step: number;
  endsAt: number;
  total: number;
  done: boolean;
}

const WAKE_TAG = 'skanu-cook';

export default function CookScreen() {
  const params = useLocalSearchParams<{ id: string; servings?: string; units?: string; view?: string }>();
  const t = useT();
  const lang = useLang();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const recipe = useStore((s) => s.recipes.find((r) => r.id === params.id));
  const settings = useStore((s) => s.settings);

  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const timersRef = useRef(timers);
  timersRef.current = timers;

  // Keep the screen on while cooking; the reason this screen exists.
  useEffect(() => {
    activateKeepAwakeAsync(WAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(WAKE_TAG).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const active = timers.some((x) => !x.done);
    if (!active) return;
    const h = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      const due = timersRef.current.filter((x) => !x.done && x.endsAt <= ts);
      if (due.length > 0) {
        setTimers((list) => list.map((x) => (x.endsAt <= ts ? { ...x, done: true } : x)));
        toast(`⏰ ${t('cook_timer_done')}: ${due[0].label}`);
        if (Platform.OS !== 'web') {
          Vibration.vibrate([0, 500, 250, 500, 250, 500]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    }, 500);
    return () => clearInterval(h);
  }, [timers, t]);

  const units: UnitSystem = params.units === 'metric' || params.units === 'us' || params.units === 'original' ? params.units : settings.units;
  const translation = recipe && params.view && params.view !== 'original' ? recipe.translations?.[params.view as Lang] : undefined;
  const steps = useMemo(
    () => (recipe ? (translation?.steps.length ? translation.steps : recipe.steps).map((s) => convertTemperatures(s, units)) : []),
    [recipe, translation, units],
  );

  if (!recipe || steps.length === 0) {
    return (
      <Screen>
        <Header back />
        <Empty icon="alert-circle-outline" title={t(recipe ? 'cook_no_steps' : 'recipe_not_found')} />
      </Screen>
    );
  }

  const servings = Number(params.servings) > 0 ? Number(params.servings) : recipe.servings;
  const scale = servings / (recipe.servings || 1);
  const ingredients =
    translation && translation.ingredients.length === recipe.ingredients.length
      ? recipe.ingredients.map((o, i) => ({ ...parseIngredient(translation.ingredients[i]), id: o.id, header: o.header }))
      : recipe.ingredients;
  const step = steps[Math.min(index, steps.length - 1)];
  const suggestions = findTimers(step);
  const last = index >= steps.length - 1;
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/recipe/${recipe.id}`));

  const start = (label: string, seconds: number) => {
    const ts = Date.now();
    setNow(ts);
    setTimers((list) => [...list, { id: `${ts}-${list.length}`, label, step: index, endsAt: ts + seconds * 1000, total: seconds, done: false }]);
  };

  if (finished) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <Empty icon="checkmark-circle-outline" title={t('cook_done_title')} body={t('cook_done_body')}>
          <Btn title={t('done')} onPress={close} />
        </Empty>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <IconBtn name="close" label={t('close')} onPress={close} />
        <View style={{ flex: 1 }}>
          <Txt v="small" numberOfLines={1}>
            {translation?.title || recipe.title}
          </Txt>
          <Txt v="h3">{t('cook_step_of', { n: index + 1, total: steps.length })}</Txt>
        </View>
        <Btn small variant="secondary" icon="list" title={t('ingredients')} onPress={() => setShowIngredients(true)} />
      </View>

      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: space.lg, paddingTop: space.md }} accessibilityElementsHidden>
        {steps.map((_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? c.primary : c.border }} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl, flexGrow: 1, justifyContent: 'center' }}>
        <Txt style={{ fontSize: 26, lineHeight: 37, fontWeight: '500' }} testID="cook-step">
          {step}
        </Txt>
        {suggestions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {suggestions.map((s, i) => (
              <Btn key={`${index}-${i}`} small variant="secondary" icon="timer-outline" title={`${t('cook_timer_start')} · ${s.label}`} onPress={() => start(s.label, s.seconds)} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {timers.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
          {timers.map((tm) => {
            const left = Math.max(0, (tm.endsAt - now) / 1000);
            return (
              <Pressable
                key={tm.id}
                onPress={() => setTimers((list) => list.filter((x) => x.id !== tm.id))}
                accessibilityRole="button"
                accessibilityLabel={`${tm.label} ${tm.done ? t('cook_timer_done') : formatClock(left)}. ${t('remove')}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  paddingVertical: 8,
                  paddingHorizontal: space.md,
                  borderRadius: radius.pill,
                  backgroundColor: tm.done ? c.accent : c.primarySoft,
                }}>
                <Ionicons name={tm.done ? 'checkmark-circle' : 'timer'} size={18} color={tm.done ? '#fff' : c.primary} />
                <Txt v="h3" color={tm.done ? '#fff' : c.text} style={{ fontVariant: ['tabular-nums'] }}>
                  {tm.done ? t('cook_timer_done') : formatClock(left)}
                </Txt>
                <Txt v="small" color={tm.done ? '#fff' : c.sub}>
                  {t('cook_step_n', { n: tm.step + 1 })}
                </Txt>
                <Ionicons name="close" size={14} color={tm.done ? '#fff' : c.sub} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.md, padding: space.lg, paddingBottom: insets.bottom + space.lg }}>
        <Btn variant="secondary" icon="chevron-back" title={t('cook_prev')} disabled={index === 0} onPress={() => setIndex((i) => Math.max(0, i - 1))} style={{ flex: 1 }} />
        <Btn
          title={t(last ? 'cook_finish' : 'cook_next')}
          icon={last ? 'checkmark' : 'chevron-forward'}
          onPress={() => (last ? setFinished(true) : setIndex((i) => i + 1))}
          style={{ flex: 1.4 }}
          testID="cook-next"
        />
      </View>

      <Sheet visible={showIngredients} onClose={() => setShowIngredients(false)} title={`${t('ingredients')} · ${servings} ${t('servings_short')}`}>
        {ingredients.map((ing) =>
          ing.header ? (
            <Txt key={ing.id} v="label" style={{ marginTop: space.sm }}>
              {ing.name}
            </Txt>
          ) : (
            <Txt key={ing.id} style={{ paddingVertical: 4 }}>
              {displayIngredient(ing, { scale, system: units, useDl: settings.useDl, lang, contentLang: translation ? params.view : recipe.lang })}
            </Txt>
          ),
        )}
      </Sheet>
    </Screen>
  );
}
