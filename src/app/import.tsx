import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Card, Field, Header, RecipeImage, Screen, Segmented, Txt } from '@/components/ui';
import { useT, type Key } from '@/i18n';
import { aiParseImage, aiParseText, getServerStatus, importFromUrl, type ServerStatus } from '@/lib/api';
import { firstUrl, unwrapSocialCaption } from '@/lib/importer';
import { isUsableDraft, parseRecipeText } from '@/lib/parseText';
import { pickImage, readClipboard, type PickedImage } from '@/lib/platform';
import type { RecipeDraft } from '@/lib/types';
import { useStore } from '@/store';
import { radius, space, useColors } from '@/theme';

type Mode = 'link' | 'text' | 'photo';

export default function ImportScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string; url?: string; text?: string; auto?: string }>();
  const setDraft = useStore((s) => s.setDraft);

  const [mode, setMode] = useState<Mode>(params.mode === 'text' || params.mode === 'photo' ? params.mode : 'link');
  const [url, setUrl] = useState(params.url ?? '');
  const [text, setText] = useState(params.text ?? '');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Key | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const autoRan = useRef(false);

  useEffect(() => {
    let live = true;
    getServerStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);

  const openEditor = (draft: RecipeDraft, partial: boolean) => {
    setDraft(draft);
    router.replace({ pathname: '/recipe/edit', params: { imported: partial ? 'partial' : 'ok' } });
  };

  const runLink = async (value = url) => {
    const link = firstUrl(value) ?? (/^[\w-]+(\.[\w-]+)+/.test(value.trim()) ? `https://${value.trim()}` : undefined);
    setError(null);
    setCaption(null);
    if (!link) return setError('import_err_url');
    setBusy(true);
    const res = await importFromUrl(link);
    setBusy(false);
    if (res.ok) return openEditor(res.draft, !!res.partial);
    if (res.reason === 'norecipe' && res.summary?.description) setCaption(unwrapSocialCaption(res.summary.description));
    if (res.reason === 'blocked') setError('import_err_blocked');
    else if (res.reason === 'fetch') setError(Platform.OS === 'web' && status && !status.reachable ? 'import_err_server' : 'import_err_fetch');
    else setError(res.ai === false ? 'import_err_norecipe_noai' : 'import_err_norecipe');
  };

  useEffect(() => {
    if (params.auto === '1' && params.url && !autoRan.current) {
      autoRan.current = true;
      runLink(params.url);
    }
    // Runs once for a link shared into the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runText = async (useAi: boolean) => {
    setError(null);
    const value = text.trim();
    if (value.length < 10) return setError('import_err_text_short');
    if (useAi) {
      setBusy(true);
      const res = await aiParseText(value);
      setBusy(false);
      if (res.ok) return openEditor(res.draft, false);
      return setError(res.error === 'no_recipe' ? 'import_err_norecipe' : 'import_err_ai');
    }
    const draft = parseRecipeText(value);
    if (isUsableDraft(draft)) return openEditor(draft, true);
    // Nothing recognisable: hand the text over as-is rather than losing it.
    setError(status?.ai ? 'import_err_text_unclear_ai' : 'import_err_text_unclear');
  };

  const choosePhoto = async (source: 'library' | 'camera') => {
    setError(null);
    try {
      const img = await pickImage(source);
      if (img) setPhoto(img);
    } catch {
      setError('import_err_photo_permission');
    }
  };

  const runPhoto = async () => {
    if (!photo) return;
    setError(null);
    setBusy(true);
    const res = await aiParseImage(photo.base64, photo.mediaType);
    setBusy(false);
    if (res.ok) return openEditor({ ...res.draft, image: photo.uri }, false);
    setError(res.error === 'no_recipe' ? 'import_err_photo_norecipe' : 'import_err_ai');
  };

  const aiOn = !!status?.ai;

  return (
    <Screen>
      <Header back title={t('import_title')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xxl }}>
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: 'link', label: t('import_tab_link') },
              { value: 'text', label: t('import_tab_text') },
              { value: 'photo', label: t('import_tab_photo') },
            ]}
          />

          {mode === 'link' ? (
            <>
              <Field
                label={t('import_link_label')}
                placeholder="https://"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={() => runLink()}
                hint={t('import_link_hint')}
              />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Btn
                  title={t('paste')}
                  icon="clipboard-outline"
                  variant="secondary"
                  onPress={async () => {
                    const clip = await readClipboard();
                    if (clip) setUrl(firstUrl(clip) ?? clip.trim());
                  }}
                />
                <Btn title={t('import_go')} icon="download-outline" onPress={() => runLink()} loading={busy} style={{ flex: 1 }} testID="import-link" />
              </View>
              {caption ? (
                <Card style={{ gap: space.sm }}>
                  <Txt v="label">{t('import_caption_found')}</Txt>
                  <Txt v="sub" numberOfLines={6}>
                    {caption}
                  </Txt>
                  <Btn
                    small
                    variant="secondary"
                    title={t('import_caption_use')}
                    onPress={() => {
                      setText(caption);
                      setMode('text');
                      setError(null);
                    }}
                  />
                </Card>
              ) : null}
              <Card style={{ gap: 6, backgroundColor: c.primarySoft, borderColor: 'transparent' }}>
                <Txt v="h3">{t('import_social_title')}</Txt>
                <Txt v="sub" color={c.text}>
                  {t('import_social_body')}
                </Txt>
              </Card>
            </>
          ) : null}

          {mode === 'text' ? (
            <>
              <Field
                label={t('import_text_label')}
                placeholder={t('import_text_ph')}
                value={text}
                onChangeText={setText}
                multiline
                style={{ minHeight: 220 }}
              />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Btn
                  title={t('paste')}
                  icon="clipboard-outline"
                  variant="secondary"
                  onPress={async () => {
                    const clip = await readClipboard();
                    if (clip) setText(clip);
                  }}
                />
                <Btn title={t('import_parse')} onPress={() => runText(false)} disabled={busy} style={{ flex: 1 }} testID="import-text" />
              </View>
              {aiOn ? <Btn title={t('import_parse_ai')} icon="sparkles-outline" variant="secondary" onPress={() => runText(true)} loading={busy} /> : null}
              <Txt v="small">{t('import_text_hint')}</Txt>
            </>
          ) : null}

          {mode === 'photo' ? (
            <>
              {photo ? <RecipeImage uri={photo.uri} title="photo" style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg }} /> : null}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Btn title={t('photo_choose')} icon="images-outline" variant="secondary" onPress={() => choosePhoto('library')} style={{ flex: 1 }} />
                {Platform.OS !== 'web' ? (
                  <Btn title={t('photo_take')} icon="camera-outline" variant="secondary" onPress={() => choosePhoto('camera')} style={{ flex: 1 }} />
                ) : null}
              </View>
              {photo && aiOn ? <Btn title={t('import_photo_read')} icon="sparkles-outline" onPress={runPhoto} loading={busy} /> : null}
              {photo && !aiOn ? (
                <Btn title={t('import_photo_manual')} icon="create-outline" onPress={() => openEditor({ title: '', ingredients: [], steps: [], image: photo.uri }, false)} />
              ) : null}
              <Txt v="small">{t(aiOn ? 'import_photo_hint' : 'import_photo_noai')}</Txt>
            </>
          ) : null}

          {error ? (
            <Card style={{ borderColor: c.danger, gap: space.sm }}>
              <Txt color={c.danger} accessibilityRole="alert">
                {t(error)}
              </Txt>
              {mode === 'text' && (error === 'import_err_text_unclear' || error === 'import_err_text_unclear_ai') ? (
                <Btn
                  small
                  variant="secondary"
                  title={t('import_edit_anyway')}
                  onPress={() => {
                    const lines = text.trim().split('\n');
                    openEditor({ title: lines[0].slice(0, 100), ingredients: [], steps: [], notes: text.trim() }, true);
                  }}
                />
              ) : null}
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
