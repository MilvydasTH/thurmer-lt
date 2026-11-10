import { useColorScheme } from 'react-native';

import { useStore } from '@/store';

export const palettes = {
  light: {
    bg: '#FAF6EF',
    card: '#FFFFFF',
    text: '#1F1A17',
    sub: '#6F665E',
    border: '#E9E1D6',
    primary: '#D9480F',
    onPrimary: '#FFFFFF',
    primarySoft: '#FCE9DF',
    accent: '#2F7D5B',
    accentSoft: '#E0F0E8',
    danger: '#C92A2A',
    chip: '#F1EADF',
    overlay: 'rgba(20,14,10,0.45)',
  },
  dark: {
    bg: '#141210',
    card: '#1F1C19',
    text: '#F5EFE8',
    sub: '#A69C92',
    border: '#322D28',
    primary: '#FF7A45',
    onPrimary: '#1A0E08',
    primarySoft: '#3A2015',
    accent: '#5DBB8F',
    accentSoft: '#17302A',
    danger: '#FF6B6B',
    chip: '#2A2622',
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

export type Colors = { [K in keyof typeof palettes.light]: string };

export function useIsDark(): boolean {
  const pref = useStore((s) => s.settings.theme);
  const system = useColorScheme();
  return pref === 'system' ? system === 'dark' : pref === 'dark';
}

export function useColors(): Colors {
  return useIsDark() ? palettes.dark : palettes.light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const MAX_WIDTH = 720;

/** Stable pastel for image placeholders, derived from the title. */
export function tintFor(seed: string, dark: boolean): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return dark ? `hsl(${h}, 28%, 24%)` : `hsl(${h}, 55%, 86%)`;
}
