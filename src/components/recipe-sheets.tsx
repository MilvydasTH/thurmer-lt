import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { dayLabel, useLang, useT, type Key } from '@/i18n';
import { displayIngredient } from '@/lib/convert';
import { addDays, startOfWeek, toISO } from '@/lib/dates';
import { ingredientToGrocery, isPantryItem } from '@/lib/grocery';
import { PLAN_SLOTS, type PlanSlot, type Recipe } from '@/lib/types';
import { useStore } from '@/store';
import { space, useColors } from '@/theme';

import { Btn, Check, Chip, Field, Segmented, Sheet, Txt, toast } from './ui';

/** Pick which ingredients go on the shopping list. Pantry staples start unticked. */
export function GroceryAddSheet({
  recipe,
  scale,
  visible,
  onClose,
}: {
  recipe: Recipe;
  scale: number;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const settings = useStore((s) => s.settings);
  const addGroceries = useStore((s) => s.addGroceries);
  const items = useMemo(() => recipe.ingredients.filter((i) => !i.header), [recipe.ingredients]);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setPicked(items.filter((i) => !isPantryItem(i.name, settings.pantry)).map((i) => i.id));
  }, [visible, items, settings.pantry]);

  const add = () => {
    addGroceries(items.filter((i) => picked.includes(i.id)).map((i) => ingredientToGrocery(i, scale, recipe)));
    toast(t('added_to_groceries', { n: picked.length }));
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('add_to_groceries')}
      footer={<Btn title={t('add_selected', { n: picked.length })} onPress={add} disabled={picked.length === 0} testID="grocery-add-confirm" />}>
      {items.map((i) => (
        <Check
          key={i.id}
          checked={picked.includes(i.id)}
          onPress={() => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))}
          label={displayIngredient(i, { scale, system: settings.units, useDl: settings.useDl, lang, contentLang: recipe.lang })}
          sub={isPantryItem(i.name, settings.pantry) ? t('in_pantry') : undefined}
        />
      ))}
    </Sheet>
  );
}

export function PlanAddSheet({ recipe, visible, onClose }: { recipe: Recipe; visible: boolean; onClose: () => void }) {
  const t = useT();
  const c = useColors();
  const addPlan = useStore((s) => s.addPlan);
  const [slot, setSlot] = useState<PlanSlot>('dinner');
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
    // Recomputed each time the sheet opens so "today" is never stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const [date, setDate] = useState(toISO(new Date()));
  const nextWeek = toISO(addDays(startOfWeek(new Date()), 7));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('add_to_plan')}
      footer={
        <Btn
          title={t('add')}
          onPress={() => {
            addPlan({ date, slot, recipeId: recipe.id });
            toast(t('added_to_plan'));
            onClose();
          }}
        />
      }>
      <Txt v="label">{t('plan_meal')}</Txt>
      <Segmented value={slot} onChange={setSlot} options={PLAN_SLOTS.map((s) => ({ value: s, label: t(`meal_${s}` as Key) }))} />
      <Txt v="label" style={{ marginTop: space.md }}>
        {t('plan_day')}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}>
        {days.map((d, i) => {
          const iso = toISO(d);
          return <Chip key={iso} label={i === 0 ? t('today') : dayLabel(t, d)} selected={iso === date} onPress={() => setDate(iso)} />;
        })}
      </ScrollView>
      {date >= nextWeek ? (
        <Txt v="small" color={c.sub}>
          {t('plan_next_week_note')}
        </Txt>
      ) : null}
    </Sheet>
  );
}

const EMOJIS = ['📖', '🥗', '🍝', '🍲', '🥘', '🍰', '🥐', '🍳', '🌮', '🍣', '🥦', '🍗', '🐟', '🧁', '🍹', '🎄', '👶', '⚡'];

export function CookbookFormSheet({
  visible,
  onClose,
  cookbookId,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  cookbookId?: string;
  onCreated?: (id: string) => void;
}) {
  const t = useT();
  const cookbooks = useStore((s) => s.cookbooks);
  const existing = cookbooks.find((b) => b.id === cookbookId);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);

  useEffect(() => {
    if (visible) {
      setName(existing?.name ?? '');
      setEmoji(existing?.emoji ?? EMOJIS[0]);
    }
  }, [visible, existing]);

  const save = () => {
    if (!name.trim()) return;
    const s = useStore.getState();
    if (existing) s.updateCookbook(existing.id, { name: name.trim(), emoji });
    else onCreated?.(s.addCookbook(name, emoji));
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t(existing ? 'cookbook_rename' : 'cookbook_new')}
      footer={<Btn title={t('save')} onPress={save} disabled={!name.trim()} testID="cookbook-save" />}>
      <Field label={t('cookbook_name')} placeholder={t('cookbook_name_ph')} value={name} onChangeText={setName} autoFocus onSubmitEditing={save} returnKeyType="done" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
        {EMOJIS.map((e) => (
          <Chip key={e} label={e} selected={e === emoji} onPress={() => setEmoji(e)} />
        ))}
      </View>
    </Sheet>
  );
}

export function CookbookPickSheet({ recipe, visible, onClose }: { recipe: Recipe; visible: boolean; onClose: () => void }) {
  const t = useT();
  const cookbooks = useStore((s) => s.cookbooks);
  const setRecipeCookbooks = useStore((s) => s.setRecipeCookbooks);
  const [creating, setCreating] = useState(false);
  const toggle = (id: string) =>
    setRecipeCookbooks(recipe.id, recipe.cookbookIds.includes(id) ? recipe.cookbookIds.filter((x) => x !== id) : [...recipe.cookbookIds, id]);

  return (
    <>
      <Sheet visible={visible && !creating} onClose={onClose} title={t('choose_cookbooks')} footer={<Btn title={t('done')} onPress={onClose} />}>
        {cookbooks.length === 0 ? <Txt v="sub">{t('cookbooks_empty_body')}</Txt> : null}
        {cookbooks.map((b) => (
          <Check key={b.id} checked={recipe.cookbookIds.includes(b.id)} onPress={() => toggle(b.id)} label={`${b.emoji}  ${b.name}`} />
        ))}
        <Btn variant="secondary" icon="add" title={t('cookbook_new')} onPress={() => setCreating(true)} style={{ marginTop: space.sm }} />
      </Sheet>
      <CookbookFormSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => setRecipeCookbooks(recipe.id, [...recipe.cookbookIds, id])}
      />
    </>
  );
}
