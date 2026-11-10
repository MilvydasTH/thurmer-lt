import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Card, Chip, Field, Header, RecipeImage, Screen, Txt, confirm, toast } from '@/components/ui';
import { useT, type Key } from '@/i18n';
import { pickImage } from '@/lib/platform';
import { MEAL_TYPES, type MealType, type RecipeDraft } from '@/lib/types';
import { recipeToDraft, useStore } from '@/store';
import { radius, space, useColors } from '@/theme';

const num = (s: string): number | undefined => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export default function EditRecipeScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id, imported } = useLocalSearchParams<{ id?: string; imported?: string }>();

  // Read the starting point once; later store updates must not overwrite what is being typed.
  const initial = useMemo<RecipeDraft>(() => {
    const s = useStore.getState();
    if (id) {
      const r = s.recipes.find((x) => x.id === id);
      if (r) return recipeToDraft(r);
    }
    return s.draft ?? { title: '', ingredients: [], steps: [] };
  }, [id]);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const [image, setImage] = useState(initial.image);
  const [servings, setServings] = useState(initial.servings ? String(initial.servings) : '');
  const [prep, setPrep] = useState(initial.prepMin ? String(initial.prepMin) : '');
  const [cook, setCook] = useState(initial.cookMin ? String(initial.cookMin) : '');
  const [ingredients, setIngredients] = useState(initial.ingredients.join('\n'));
  const [steps, setSteps] = useState(initial.steps.join('\n\n'));
  const [mealTypes, setMealTypes] = useState<MealType[]>(initial.mealTypes ?? []);
  const [tags, setTags] = useState((initial.tags ?? []).join(', '));
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [kcal, setKcal] = useState(initial.nutrition ? String(initial.nutrition.kcal) : '');
  const [dirty, setDirty] = useState(!!imported);
  const [titleError, setTitleError] = useState(false);

  const touch =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setDirty(true);
    };

  const leave = async () => {
    if (dirty && !(await confirm(t('discard_q'), t('discard_body'), t('discard'), t('keep_editing')))) return;
    useStore.getState().setDraft(null);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const save = () => {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    const kcalNum = num(kcal);
    const draft: RecipeDraft = {
      ...initial,
      title,
      description,
      image,
      servings: num(servings),
      prepMin: num(prep),
      cookMin: num(cook),
      ingredients: ingredients.split('\n'),
      steps: steps.split(/\n+/),
      mealTypes,
      tags: tags.split(','),
      sourceUrl,
      notes,
      // Keep source macros only while the calorie figure is left as imported.
      nutrition: kcalNum
        ? initial.nutrition && initial.nutrition.kcal === kcalNum
          ? initial.nutrition
          : { kcal: Math.round(kcalNum), protein: 0, carbs: 0, fat: 0 }
        : undefined,
    };
    const saved = useStore.getState().saveDraft(draft);
    useStore.getState().setDraft(null);
    toast(t('saved'));
    if (initial.id && router.canGoBack()) router.back();
    else router.replace(`/recipe/${saved.id}`);
  };

  const choosePhoto = async (source: 'library' | 'camera') => {
    try {
      const img = await pickImage(source);
      if (img) touch(setImage)(img.uri);
    } catch {
      toast(t('import_err_photo_permission'));
    }
  };

  return (
    <Screen>
      <Header back onBack={leave} title={t(initial.id ? 'edit_title_edit' : 'edit_title_new')} right={<Btn small title={t('save')} onPress={save} testID="save-recipe" />} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + 64 }}>
          {imported ? (
            <Card style={{ backgroundColor: c.accentSoft, borderColor: 'transparent' }}>
              <Txt v="sub" color={c.text}>
                {t(imported === 'partial' ? 'import_review_partial' : 'import_review')}
              </Txt>
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <RecipeImage uri={image} title={title || 'recipe'} style={{ width: 96, height: 96, borderRadius: radius.lg }} />
            <View style={{ flex: 1, gap: space.sm }}>
              <Btn small variant="secondary" icon="images-outline" title={t('photo_choose')} onPress={() => choosePhoto('library')} />
              {Platform.OS !== 'web' ? <Btn small variant="secondary" icon="camera-outline" title={t('photo_take')} onPress={() => choosePhoto('camera')} /> : null}
              {image ? <Btn small variant="ghost" title={t('photo_remove')} onPress={() => touch(setImage)(undefined)} /> : null}
            </View>
          </View>

          <Field
            label={t('field_title')}
            value={title}
            onChangeText={(v) => {
              touch(setTitle)(v);
              setTitleError(false);
            }}
            hint={titleError ? t('title_required') : undefined}
            style={titleError ? { borderColor: c.danger } : undefined}
          />
          <Field label={t('field_description')} value={description} onChangeText={touch(setDescription)} multiline style={{ minHeight: 70 }} />

          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Field label={t('servings')} value={servings} onChangeText={touch(setServings)} keyboardType="number-pad" placeholder="2" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('field_prep')} value={prep} onChangeText={touch(setPrep)} keyboardType="number-pad" placeholder={t('min')} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('field_cook')} value={cook} onChangeText={touch(setCook)} keyboardType="number-pad" placeholder={t('min')} />
            </View>
          </View>

          <Field
            label={t('ingredients')}
            value={ingredients}
            onChangeText={touch(setIngredients)}
            multiline
            autoCapitalize="none"
            placeholder={t('field_ingredients_ph')}
            hint={t('field_ingredients_hint')}
            style={{ minHeight: 170 }}
          />
          <Field
            label={t('steps')}
            value={steps}
            onChangeText={touch(setSteps)}
            multiline
            placeholder={t('field_steps_ph')}
            hint={t('field_steps_hint')}
            style={{ minHeight: 200 }}
          />

          <View style={{ gap: space.sm }}>
            <Txt v="label">{t('field_meal_types')}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {MEAL_TYPES.map((m) => (
                <Chip
                  key={m}
                  label={t(`meal_${m}` as Key)}
                  selected={mealTypes.includes(m)}
                  onPress={() => touch(setMealTypes)(mealTypes.includes(m) ? mealTypes.filter((x) => x !== m) : [...mealTypes, m])}
                />
              ))}
            </View>
          </View>

          <Field label={t('field_tags')} value={tags} onChangeText={touch(setTags)} autoCapitalize="none" hint={t('field_tags_hint')} />
          <Field label={t('notes')} value={notes} onChangeText={touch(setNotes)} multiline style={{ minHeight: 80 }} />
          <Field label={t('field_source')} value={sourceUrl} onChangeText={touch(setSourceUrl)} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://" />
          <Field label={t('field_kcal')} value={kcal} onChangeText={touch(setKcal)} keyboardType="number-pad" hint={t('field_kcal_hint')} />

          <Btn title={t('save')} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
