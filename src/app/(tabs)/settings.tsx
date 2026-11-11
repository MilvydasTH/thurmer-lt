import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Card, Chip, Field, Header, MenuRow, Screen, Segmented, Txt, confirm, toast } from '@/components/ui';
import { LANGUAGES, useT } from '@/i18n';
import { getServerStatus, type ServerStatus } from '@/lib/api';
import { pickTextFile, saveTextFile } from '@/lib/platform';
import { DEFAULT_PANTRY, useStore } from '@/store';
import { space, useColors } from '@/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Txt v="label">{title}</Txt>
      <Card style={{ gap: space.md }}>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const recipeCount = useStore((s) => s.recipes.length);
  const [staple, setStaple] = useState('');
  const [status, setStatus] = useState<ServerStatus | null>(null);

  useEffect(() => {
    let live = true;
    getServerStatus(true).then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);

  const addStaple = () => {
    const v = staple.trim().toLowerCase();
    if (!v) return;
    if (!settings.pantry.includes(v)) update({ pantry: [...settings.pantry, v] });
    setStaple('');
  };

  const exportData = async () => {
    try {
      const backup = useStore.getState().exportBackup();
      await saveTextFile(`skanu-backup-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
      toast(t('settings_export_done'));
    } catch {
      toast(t('settings_export_err'));
    }
  };

  const importData = async () => {
    try {
      const text = await pickTextFile();
      if (text === null) return;
      const n = useStore.getState().importBackup(JSON.parse(text));
      toast(t('settings_import_done', { n }));
    } catch {
      toast(t('settings_import_err'));
    }
  };

  return (
    <Screen>
      <Header large title={t('settings_title')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: insets.bottom + space.xxl }}>
        <Section title={t('language')}>
          <Segmented
            value={settings.lang}
            options={LANGUAGES}
            onChange={(lang) => {
              // Carry the starter pantry over to the new language if it was never customised.
              const untouched = JSON.stringify(settings.pantry) === JSON.stringify(DEFAULT_PANTRY[settings.lang]);
              update({ lang, ...(untouched ? { pantry: DEFAULT_PANTRY[lang] } : {}) });
            }}
          />
          <Txt v="small">{t('settings_language_help')}</Txt>
        </Section>

        <Section title={t('settings_units')}>
          <Segmented
            value={settings.units}
            onChange={(units) => update({ units })}
            options={[
              { value: 'original', label: t('units_original') },
              { value: 'metric', label: t('units_metric') },
              { value: 'us', label: t('units_us') },
            ]}
          />
          <Txt v="small">{t('settings_units_help')}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Txt v="h3">{t('settings_use_dl')}</Txt>
              <Txt v="small">{t('settings_use_dl_help')}</Txt>
            </View>
            <Switch
              value={settings.useDl}
              onValueChange={(useDl) => update({ useDl })}
              accessibilityLabel={t('settings_use_dl')}
              trackColor={{ true: c.accent, false: c.border }}
            />
          </View>
        </Section>

        <Section title={t('settings_theme')}>
          <Segmented
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'system', label: t('theme_system') },
              { value: 'light', label: t('theme_light') },
              { value: 'dark', label: t('theme_dark') },
            ]}
          />
        </Section>

        <Section title={t('settings_pantry')}>
          <Txt v="small">{t('settings_pantry_help')}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {settings.pantry.map((p) => (
              <Chip key={p} label={`${p}  ✕`} onPress={() => update({ pantry: settings.pantry.filter((x) => x !== p) })} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field placeholder={t('settings_pantry_ph')} value={staple} onChangeText={setStaple} onSubmitEditing={addStaple} autoCapitalize="none" returnKeyType="done" />
            </View>
            <Btn variant="secondary" title={t('add')} onPress={addStaple} disabled={!staple.trim()} />
          </View>
        </Section>

        <Section title={t('settings_offers')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Txt v="h3">{t('offers_enable')}</Txt>
              <Txt v="small">{t('settings_offers_help')}</Txt>
            </View>
            <Switch
              value={settings.offers}
              onValueChange={(offers) => update({ offers })}
              accessibilityLabel={t('offers_enable')}
              trackColor={{ true: c.accent, false: c.border }}
            />
          </View>
        </Section>

        <Section title={t('settings_backup')}>
          <Txt v="small">{t('settings_backup_help', { n: recipeCount })}</Txt>
          <MenuRow icon="download-outline" title={t('settings_export')} onPress={exportData} />
          <MenuRow icon="push-outline" title={t('settings_import')} onPress={importData} />
        </Section>

        <Section title={t('settings_ai')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: status?.ai ? c.accent : c.sub }} />
            <Txt v="h3">{status === null ? '…' : t(status.ai ? 'settings_ai_on' : status.reachable ? 'settings_ai_off' : 'settings_ai_noserver')}</Txt>
          </View>
          <Txt v="small">{t('settings_ai_help')}</Txt>
        </Section>

        <Section title={t('settings_data')}>
          <MenuRow icon="sparkles-outline" title={t('settings_samples')} onPress={() => { useStore.getState().addSamples(); toast(t('settings_samples_done')); }} />
          <MenuRow
            icon="trash-outline"
            danger
            title={t('settings_reset')}
            onPress={async () => {
              if (await confirm(t('settings_reset'), t('settings_reset_body'), t('delete'), t('cancel'))) useStore.getState().resetAll();
            }}
          />
        </Section>

        <View style={{ gap: 4, alignItems: 'center' }}>
          <Txt v="h3">Skanu</Txt>
          <Txt v="small" style={{ textAlign: 'center', maxWidth: 420 }}>
            {t('settings_about')}
          </Txt>
        </View>
      </ScrollView>
    </Screen>
  );
}
