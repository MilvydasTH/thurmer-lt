import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipePicker } from '@/components/recipe-bits';
import { Btn, Card, Field, Header, IconBtn, Screen, Segmented, Txt, confirm, toast } from '@/components/ui';
import { dayLabel, useT, type Key } from '@/i18n';
import { addDays, fromISO, startOfWeek, toISO, weekDates } from '@/lib/dates';
import { ingredientToGrocery, isPantryItem, type NewGrocery } from '@/lib/grocery';
import { PLAN_SLOTS, type PlanSlot } from '@/lib/types';
import { useStore } from '@/store';
import { space, useColors } from '@/theme';

export default function PlanScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const plan = useStore((s) => s.plan);
  const recipes = useStore((s) => s.recipes);
  const pantry = useStore((s) => s.settings.pantry);
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const [slot, setSlot] = useState<PlanSlot>('dinner');
  const [note, setNote] = useState('');

  const today = toISO(new Date());
  const start = useMemo(() => addDays(startOfWeek(new Date()), offset * 7), [offset]);
  const dates = useMemo(() => weekDates(start), [start]);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const weekEntries = plan.filter((p) => dates.includes(p.date));
  const months = t('months_short').split('|');
  const end = addDays(start, 6);
  const range =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${months[end.getMonth()]}`
      : `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`;

  const weekToGroceries = () => {
    const items: NewGrocery[] = [];
    for (const e of weekEntries) {
      const r = e.recipeId ? byId.get(e.recipeId) : undefined;
      if (!r) continue;
      for (const ing of r.ingredients) {
        if (ing.header || isPantryItem(ing.name, pantry)) continue;
        items.push(ingredientToGrocery(ing, 1, r));
      }
    }
    if (items.length === 0) return toast(t('plan_nothing'));
    useStore.getState().addGroceries(items);
    toast(t('added_to_groceries', { n: items.length }));
  };

  const closeAdd = () => {
    setAdding(null);
    setNote('');
  };

  return (
    <Screen>
      <Header large title={t('plan_title')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.sm }}>
        <IconBtn filled name="chevron-back" label={t('plan_prev')} onPress={() => setOffset((o) => o - 1)} />
        <Pressable onPress={() => setOffset(0)} accessibilityRole="button" accessibilityLabel={t('plan_this_week')} style={{ flex: 1, alignItems: 'center' }}>
          <Txt v="h3">{range}</Txt>
          <Txt v="small" color={offset === 0 ? c.primary : c.sub}>
            {offset === 0 ? t('plan_this_week') : t('plan_back_to_today')}
          </Txt>
        </Pressable>
        <IconBtn filled name="chevron-forward" label={t('plan_next')} onPress={() => setOffset((o) => o + 1)} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xxl }}>
        {dates.map((iso) => {
          const entries = plan
            .filter((p) => p.date === iso)
            .sort((a, b) => PLAN_SLOTS.indexOf(a.slot) - PLAN_SLOTS.indexOf(b.slot));
          const isToday = iso === today;
          return (
            <Card key={iso} style={{ gap: space.sm, borderColor: isToday ? c.primary : c.border, borderWidth: isToday ? 1.5 : 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Txt v="h3" style={{ flex: 1 }} color={isToday ? c.primary : undefined}>
                  {dayLabel(t, fromISO(iso), true)}
                  {isToday ? ` · ${t('today')}` : ''}
                </Txt>
                <IconBtn name="add" label={`${t('plan_add')} ${dayLabel(t, fromISO(iso), true)}`} color={c.primary} onPress={() => setAdding(iso)} />
              </View>
              {entries.map((e) => {
                const r = e.recipeId ? byId.get(e.recipeId) : undefined;
                return (
                  <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Pressable
                      disabled={!r}
                      onPress={() => r && router.push(`/recipe/${r.id}`)}
                      accessibilityRole={r ? 'button' : undefined}
                      style={{ flex: 1 }}>
                      <Txt v="label">{t(`meal_${e.slot}` as Key)}</Txt>
                      <Txt numberOfLines={2}>{r?.title ?? e.note ?? '—'}</Txt>
                    </Pressable>
                    <Pressable onPress={() => useStore.getState().removePlan(e.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('remove')}>
                      <Ionicons name="close" size={18} color={c.sub} />
                    </Pressable>
                  </View>
                );
              })}
              {entries.length === 0 ? <Txt v="small">{t('plan_empty_day')}</Txt> : null}
            </Card>
          );
        })}

        <Btn title={t('plan_week_to_groceries')} icon="cart-outline" onPress={weekToGroceries} disabled={weekEntries.every((e) => !e.recipeId)} />
        {weekEntries.length > 0 ? (
          <Btn
            variant="ghost"
            title={t('plan_clear_week')}
            onPress={async () => {
              if (await confirm(t('plan_clear_week'), t('plan_clear_week_body'), t('clear'), t('cancel'))) useStore.getState().clearPlan(dates);
            }}
          />
        ) : null}
      </ScrollView>

      <RecipePicker
        visible={adding !== null}
        onClose={closeAdd}
        title={adding ? dayLabel(t, fromISO(adding), true) : ''}
        onPick={(r) => {
          if (adding) useStore.getState().addPlan({ date: adding, slot, recipeId: r.id });
          closeAdd();
        }}
        header={
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
            <Segmented value={slot} onChange={setSlot} options={PLAN_SLOTS.map((s) => ({ value: s, label: t(`meal_${s}` as Key) }))} />
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Field placeholder={t('plan_note_ph')} value={note} onChangeText={setNote} />
              </View>
              <Btn
                variant="secondary"
                title={t('add')}
                disabled={!note.trim()}
                onPress={() => {
                  if (adding) useStore.getState().addPlan({ date: adding, slot, note: note.trim() });
                  closeAdd();
                }}
              />
            </View>
            <Txt v="label">{t('plan_pick_recipe')}</Txt>
          </View>
        }
      />
    </Screen>
  );
}
