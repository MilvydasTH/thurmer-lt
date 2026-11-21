import React, { useState } from 'react';
import { Switch, View } from 'react-native';

import { Btn, Field, MenuRow, Segmented, Sheet, Txt, confirm, toast } from '@/components/ui';
import { useT, type Key } from '@/i18n';
import { createFamily, joinFamily, leaveFamily, syncFamily, type FamilyError } from '@/lib/familySync';
import { normalizeCode, prettyCode } from '@/lib/familyTypes';
import { shareText } from '@/lib/platform';
import { useStore } from '@/store';
import { space, useColors } from '@/theme';

const ERRORS: Record<FamilyError, Key> = {
  not_found: 'family_err_code',
  not_member: 'family_err_code',
  bad_request: 'family_err_name',
  too_large: 'family_err_generic',
  full: 'family_err_full',
  rate_limited: 'family_err_wait',
  storage: 'family_err_generic',
  network: 'family_err_network',
};

/** Settings card for sharing recipes with family: create a family, join one, see who is in it. */
export function FamilySection() {
  const t = useT();
  const c = useColors();
  const family = useStore((s) => s.family);
  const pending = useStore((s) => s.dirty.length + s.tombstones.length + s.cartDirty.length + s.cartGone.length);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
  const [code, setCode] = useState('');
  const [myName, setMyName] = useState('');
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Key | null>(null);

  const submit = async () => {
    setError(null);
    if (!myName.trim() || (mode === 'create' ? !familyName.trim() : normalizeCode(code).length < 10)) {
      return setError(mode === 'create' ? 'family_err_name' : 'family_err_code');
    }
    setBusy(true);
    const err = mode === 'create' ? await createFamily(familyName, myName, share) : await joinFamily(code, myName, share);
    setBusy(false);
    if (err) return setError(ERRORS[err] ?? 'family_err_generic');
    setOpen(false);
    toast(t('family_joined'));
    void syncFamily();
  };

  if (!family) {
    return (
      <>
        <Txt v="small">{t('family_help')}</Txt>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Btn
            title={t('family_create')}
            icon="people-outline"
            style={{ flex: 1 }}
            testID="family-create"
            onPress={() => {
              setMode('create');
              setError(null);
              setOpen(true);
            }}
          />
          <Btn
            title={t('family_join')}
            variant="secondary"
            icon="key-outline"
            style={{ flex: 1 }}
            testID="family-join"
            onPress={() => {
              setMode('join');
              setError(null);
              setOpen(true);
            }}
          />
        </View>
        <Sheet
          visible={open}
          onClose={() => setOpen(false)}
          title={t(mode === 'create' ? 'family_create' : 'family_join')}
          footer={<Btn title={t(mode === 'create' ? 'family_create' : 'family_join')} onPress={submit} loading={busy} testID="family-submit" />}>
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: 'create', label: t('family_tab_new') },
              { value: 'join', label: t('family_tab_code') },
            ]}
          />
          {mode === 'create' ? (
            <Field label={t('family_name')} placeholder={t('family_name_ph')} value={familyName} onChangeText={setFamilyName} />
          ) : (
            <Field label={t('family_code')} placeholder="ABCDE-FGHJK" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} />
          )}
          <Field label={t('family_your_name')} placeholder={t('family_your_name_ph')} value={myName} onChangeText={setMyName} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm }}>
            <View style={{ flex: 1 }}>
              <Txt v="h3">{t('family_share_existing')}</Txt>
              <Txt v="small">{t('family_share_existing_help')}</Txt>
            </View>
            <Switch value={share} onValueChange={setShare} accessibilityLabel={t('family_share_existing')} trackColor={{ true: c.accent, false: c.border }} />
          </View>
          {error ? (
            <Txt color={c.danger} accessibilityRole="alert">
              {t(error)}
            </Txt>
          ) : null}
        </Sheet>
      </>
    );
  }

  const invite = t('family_invite_text', { name: family.name, code: prettyCode(family.code) });
  return (
    <>
      <View style={{ gap: 2 }}>
        <Txt v="h2">{family.name}</Txt>
        <Txt v="sub">{family.members.map((m) => (m.id === family.memberId ? `${m.name} (${t('family_you')})` : m.name)).join(', ')}</Txt>
      </View>
      <View style={{ gap: 2 }}>
        <Txt v="label">{t('family_code')}</Txt>
        <Txt v="h2" selectable testID="family-code" style={{ letterSpacing: 2 }}>
          {prettyCode(family.code)}
        </Txt>
        <Txt v="small">{t('family_code_help')}</Txt>
      </View>
      <MenuRow
        icon="share-outline"
        title={t('family_invite')}
        onPress={async () => {
          if ((await shareText(invite, family.name)) === 'copied') toast(t('copied'));
        }}
      />
      <MenuRow
        icon="sync-outline"
        title={t('family_sync_now')}
        sub={
          pending > 0
            ? t('family_pending', { n: pending })
            : family.lastSync
              ? t('family_synced_at', { time: new Date(family.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
              : undefined
        }
        onPress={async () => {
          const r = await syncFamily();
          toast(t(r === 'ok' ? 'family_synced' : r === 'removed' ? 'family_removed' : 'family_err_network'));
        }}
      />
      <MenuRow
        icon="exit-outline"
        danger
        title={t('family_leave')}
        onPress={async () => {
          if (await confirm(t('family_leave'), t('family_leave_body'), t('family_leave'), t('cancel'))) await leaveFamily();
        }}
      />
    </>
  );
}
