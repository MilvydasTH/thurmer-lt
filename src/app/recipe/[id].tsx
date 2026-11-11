import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { coverImage } from '@/components/recipe-bits';
import { CookbookPickSheet, GroceryAddSheet, PlanAddSheet } from '@/components/recipe-sheets';
import { Btn, Card, Check, Chip, Empty, Header, IconBtn, MenuRow, RecipeImage, Screen, Segmented, Sheet, Txt, confirm, toast } from '@/components/ui';
import { LANGUAGES, minutesLabel, useLang, useT, type Key, type TFn } from '@/i18n';
import { aiTranslate, getServerStatus } from '@/lib/api';
import { convertTemperatures, displayIngredient } from '@/lib/convert';
import { estimateNutrition } from '@/lib/nutrition';
import { openUrl, shareText } from '@/lib/platform';
import type { Ingredient, Lang, Recipe, UnitSystem } from '@/lib/types';
import { parseIngredient } from '@/lib/units';
import { useStore } from '@/store';
import { radius, space, useColors } from '@/theme';

function recipeAsText(r: Recipe, lines: string[], steps: string[], t: TFn): string {
  return [
    r.title,
    r.description,
    '',
    `${t('ingredients')} (${t('servings')}: ${r.servings})`,
    ...lines.map((l) => `• ${l}`),
    '',
    t('steps'),
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    r.sourceUrl ? `\n${r.sourceUrl}` : '',
  ]
    .filter((x) => x !== undefined)
    .join('\n')
    .trim();
}

function Macro({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Txt v="h2">
        {value}
        <Txt v="small"> {unit}</Txt>
      </Txt>
      <Txt v="small">{label}</Txt>
    </View>
  );
}

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const lang = useLang();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const recipe = useStore((s) => s.recipes.find((r) => r.id === id));
  const settings = useStore((s) => s.settings);

  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [units, setUnits] = useState<UnitSystem>(settings.units);
  const [done, setDone] = useState<string[]>([]);
  const [view, setView] = useState<'original' | Lang>('original');
  const [sheet, setSheet] = useState<null | 'menu' | 'grocery' | 'plan' | 'cookbook'>(null);
  const [translating, setTranslating] = useState(false);
  const [aiOn, setAiOn] = useState(false);

  useEffect(() => {
    let live = true;
    getServerStatus().then((s) => live && setAiOn(s.ai));
    return () => {
      live = false;
    };
  }, []);

  const translation = recipe && view !== 'original' ? recipe.translations?.[view] : undefined;

  // Translated lines are re-parsed so scaling and unit conversion keep working on them.
  const ingredients: Ingredient[] = useMemo(() => {
    if (!recipe) return [];
    if (!translation || translation.ingredients.length !== recipe.ingredients.length) return recipe.ingredients;
    return recipe.ingredients.map((orig, i) => ({ ...parseIngredient(translation.ingredients[i]), id: orig.id, header: orig.header }));
  }, [recipe, translation]);

  const estimate = useMemo(() => (recipe ? estimateNutrition(recipe.ingredients, recipe.servings) : undefined), [recipe]);

  if (!recipe) {
    return (
      <Screen>
        <Header back />
        <Empty icon="alert-circle-outline" title={t('recipe_not_found')} />
      </Screen>
    );
  }

  const cover = coverImage(recipe);
  const scale = servings / (recipe.servings || 1);
  const opts = { scale, system: units, useDl: settings.useDl, lang, contentLang: translation ? view : recipe.lang, nameLang: settings.translateNames ? lang : undefined };
  const lines = ingredients.filter((i) => !i.header).map((i) => displayIngredient(i, opts));
  const steps = (translation?.steps.length ? translation.steps : recipe.steps).map((s) => convertTemperatures(s, units));
  const title = translation?.title || recipe.title;
  const description = translation ? translation.description : recipe.description;
  const notes = translation ? (translation.notes ?? recipe.notes) : recipe.notes;
  const nutrition = recipe.nutrition ?? (estimate && estimate.counted > 0 ? estimate.perServing : undefined);
  const prep = recipe.prepMin ?? 0;
  const cook = recipe.cookMin ?? 0;
  const otherLangs = LANGUAGES.filter((l) => l.value !== recipe.lang);
  const hasTranslations = Object.keys(recipe.translations ?? {}).length > 0;

  const translate = async (target: Lang) => {
    if (recipe.translations?.[target]) return setView(target);
    setTranslating(true);
    const res = await aiTranslate(
      {
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients.map((i) => (i.header ? `${i.name}:` : i.raw)),
        steps: recipe.steps,
        notes: recipe.notes,
      },
      target,
    );
    setTranslating(false);
    if (!res.ok) return toast(t('translate_failed'));
    useStore.getState().setTranslation(recipe.id, target, res.translation);
    setView(target);
  };

  const share = async () => {
    setSheet(null);
    const result = await shareText(recipeAsText({ ...recipe, title, description, servings }, lines, steps, t), title);
    if (result === 'copied') toast(t('copied'));
  };

  const remove = async () => {
    setSheet(null);
    if (!(await confirm(t('delete_recipe_q'), t('delete_recipe_body'), t('delete'), t('cancel')))) return;
    if (router.canGoBack()) router.back();
    else router.replace('/');
    useStore.getState().deleteRecipe(recipe.id);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View>
          <RecipeImage uri={cover} title={recipe.title} iconSize={48} style={{ width: '100%', height: cover ? 260 : 150 + insets.top }} />
          <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', gap: space.sm }}>
            <IconBtn filled name="chevron-back" label={t('back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
            <View style={{ flex: 1 }} />
            <IconBtn
              filled
              name={recipe.favorite ? 'heart' : 'heart-outline'}
              color={recipe.favorite ? c.primary : undefined}
              label={t(recipe.favorite ? 'unfavorite' : 'favorite')}
              onPress={() => useStore.getState().toggleFavorite(recipe.id)}
            />
            <IconBtn filled name="ellipsis-horizontal" label={t('more')} onPress={() => setSheet('menu')} />
          </View>
        </View>

        <View style={{ padding: space.lg, gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <Txt v="title" accessibilityRole="header">
              {title}
            </Txt>
            {description ? <Txt color={c.sub}>{description}</Txt> : null}
            {recipe.sourceUrl ? (
              <Pressable onPress={() => openUrl(recipe.sourceUrl!)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="link" size={14} color={c.primary} />
                <Txt v="sub" color={c.primary} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {recipe.sourceName || recipe.sourceUrl}
                </Txt>
              </Pressable>
            ) : null}
          </View>

          {prep || cook ? (
            <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }}>
              {prep ? (
                <View>
                  <Txt v="label">{t('prep_time')}</Txt>
                  <Txt v="h3">{minutesLabel(t, prep)}</Txt>
                </View>
              ) : null}
              {cook ? (
                <View>
                  <Txt v="label">{t('cook_time')}</Txt>
                  <Txt v="h3">{minutesLabel(t, cook)}</Txt>
                </View>
              ) : null}
              {prep && cook ? (
                <View>
                  <Txt v="label">{t('total_time')}</Txt>
                  <Txt v="h3">{minutesLabel(t, prep + cook)}</Txt>
                </View>
              ) : null}
            </View>
          ) : null}

          {(hasTranslations || aiOn) && otherLangs.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Txt v="label">{t('language')}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
                <Chip label={t('original')} selected={view === 'original'} onPress={() => setView('original')} />
                {otherLangs.map((l) =>
                  recipe.translations?.[l.value] || aiOn ? (
                    <Chip
                      key={l.value}
                      label={l.label}
                      icon={recipe.translations?.[l.value] ? undefined : 'sparkles-outline'}
                      selected={view === l.value}
                      onPress={() => translate(l.value)}
                    />
                  ) : null,
                )}
                {translating ? <Txt v="small">{t('translate_working')}</Txt> : null}
              </View>
            </View>
          ) : null}

          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Txt v="h2" style={{ flex: 1 }} accessibilityRole="header">
                {t('ingredients')}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: c.chip, borderRadius: radius.pill }}>
                <IconBtn name="remove" size={18} label={t('servings_less')} disabled={servings <= 1} onPress={() => setServings((s) => Math.max(1, s - 1))} />
                <Txt v="h3" style={{ minWidth: 86, textAlign: 'center' }} accessibilityLabel={`${t('servings')}: ${servings}`}>
                  {servings} {t('servings_short')}
                </Txt>
                <IconBtn name="add" size={18} label={t('servings_more')} onPress={() => setServings((s) => Math.min(99, s + 1))} />
              </View>
            </View>
            <Segmented
              value={units}
              onChange={setUnits}
              options={[
                { value: 'original', label: t('units_original') },
                { value: 'metric', label: t('units_metric') },
                { value: 'us', label: t('units_us') },
              ]}
            />
            <Card style={{ paddingVertical: space.sm }}>
              {ingredients.map((ing) =>
                ing.header ? (
                  <Txt key={ing.id} v="label" style={{ marginTop: space.md, marginBottom: 4 }}>
                    {ing.name}
                  </Txt>
                ) : (
                  <Check
                    key={ing.id}
                    strike
                    checked={done.includes(ing.id)}
                    onPress={() => setDone((d) => (d.includes(ing.id) ? d.filter((x) => x !== ing.id) : [...d, ing.id]))}
                    label={displayIngredient(ing, opts)}
                  />
                ),
              )}
              {ingredients.length === 0 ? <Txt v="sub">{t('no_ingredients')}</Txt> : null}
            </Card>
            {scale !== 1 ? <Txt v="small">{t('scaled_note', { n: recipe.servings })}</Txt> : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Btn small variant="secondary" icon="cart-outline" title={t('add_to_groceries')} onPress={() => setSheet('grocery')} style={{ flex: 1 }} testID="to-groceries" />
              <Btn small variant="secondary" icon="calendar-outline" title={t('add_to_plan')} onPress={() => setSheet('plan')} style={{ flex: 1 }} />
            </View>
          </View>

          <View style={{ gap: space.md }}>
            <Txt v="h2" accessibilityRole="header">
              {t('steps')}
            </Txt>
            {steps.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: space.md }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt v="sub" color={c.primary} style={{ fontWeight: '800' }}>
                    {i + 1}
                  </Txt>
                </View>
                <Txt style={{ flex: 1 }}>{s}</Txt>
              </View>
            ))}
            {steps.length === 0 ? <Txt v="sub">{t('cook_no_steps')}</Txt> : null}
          </View>

          {notes ? (
            <View style={{ gap: space.sm }}>
              <Txt v="h2" accessibilityRole="header">
                {t('notes')}
              </Txt>
              <Txt>{notes}</Txt>
            </View>
          ) : null}

          <View style={{ gap: space.sm }}>
            <Txt v="h2" accessibilityRole="header">
              {t('nutrition')}
            </Txt>
            {nutrition ? (
              <Card style={{ gap: space.md }}>
                <Txt v="label">{t('nutrition_per_serving')}</Txt>
                <View style={{ flexDirection: 'row' }}>
                  <Macro label={t('kcal_label')} value={nutrition.kcal} unit="kcal" />
                  <Macro label={t('protein')} value={Math.round(nutrition.protein)} unit="g" />
                  <Macro label={t('carbs')} value={Math.round(nutrition.carbs)} unit="g" />
                  <Macro label={t('fat')} value={Math.round(nutrition.fat)} unit="g" />
                </View>
                <Txt v="small">
                  {recipe.nutrition
                    ? t('nutrition_from_source')
                    : estimate && estimate.missing.length > 0
                      ? t('nutrition_missing', { list: estimate.missing.slice(0, 6).join(', ') })
                      : t('nutrition_estimate_note')}
                </Txt>
              </Card>
            ) : (
              <Txt v="sub">{t('nutrition_unavailable')}</Txt>
            )}
          </View>

          {recipe.tags.length + recipe.mealTypes.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {recipe.mealTypes.map((m) => (
                <Chip key={m} label={t(`meal_${m}` as Key)} />
              ))}
              {recipe.tags.map((tag) => (
                <Chip key={tag} label={tag} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {steps.length > 0 ? (
        <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + space.lg }}>
          <Btn
            title={t('start_cooking')}
            icon="flame"
            testID="start-cooking"
            onPress={() => router.push({ pathname: '/cook/[id]', params: { id: recipe.id, servings: String(servings), units, view } })}
          />
        </View>
      ) : null}

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={recipe.title}>
        <MenuRow
          icon="create-outline"
          title={t('edit')}
          onPress={() => {
            setSheet(null);
            router.push({ pathname: '/recipe/edit', params: { id: recipe.id } });
          }}
        />
        <MenuRow icon="book-outline" title={t('add_to_cookbook')} onPress={() => setSheet('cookbook')} />
        <MenuRow icon="share-outline" title={t('share')} onPress={share} />
        <MenuRow
          icon="copy-outline"
          title={t('duplicate')}
          onPress={() => {
            setSheet(null);
            const copy = useStore.getState().duplicateRecipe(recipe.id, t('copy_suffix'));
            if (copy) router.replace(`/recipe/${copy}`);
          }}
        />
        <MenuRow icon="trash-outline" title={t('delete')} danger onPress={remove} />
      </Sheet>
      <GroceryAddSheet recipe={recipe} scale={scale} visible={sheet === 'grocery'} onClose={() => setSheet(null)} />
      <PlanAddSheet recipe={recipe} visible={sheet === 'plan'} onClose={() => setSheet(null)} />
      <CookbookPickSheet recipe={recipe} visible={sheet === 'cookbook'} onClose={() => setSheet(null)} />
    </Screen>
  );
}
