import { getLocales } from 'expo-localization';
import { useCallback } from 'react';

import type { Lang } from '@/lib/types';
import { useStore } from '@/store';

import { da } from './da';
import { en } from './en';
import { lt } from './lt';

export type Key = keyof typeof en;
export type Dict = Record<Key, string>;

const DICTS: Record<Lang, Dict> = { en, da, lt };

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'da', label: 'Dansk' },
  { value: 'lt', label: 'Lietuvių' },
];

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}

export type TFn = (key: Key, vars?: Record<string, string | number>) => string;

export function useT(): TFn {
  const lang = useStore((s) => s.settings.lang);
  return useCallback<TFn>((key, vars) => translate(lang, key, vars), [lang]);
}

export function useLang(): Lang {
  return useStore((s) => s.settings.lang);
}

export function detectLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    if (code === 'da' || code === 'nb' || code === 'no') return 'da';
    if (code === 'lt') return 'lt';
  } catch {
    /* fall through */
  }
  return 'en';
}

/** "Mon 12 May" style label from the dictionaries, so it never depends on the device's ICU data. */
export function dayLabel(t: TFn, date: Date, long = false): string {
  const days = t(long ? 'weekdays_long' : 'weekdays_short').split('|');
  const months = t('months_short').split('|');
  return `${days[(date.getDay() + 6) % 7]} ${date.getDate()} ${months[date.getMonth()]}`;
}

export function minutesLabel(t: TFn, min: number): string {
  if (min < 60) return `${min} ${t('min')}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ${t('h')} ${m} ${t('min')}` : `${h} ${t('h')}`;
}
