import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { IncomingShare } from '@/components/incoming-share';
import { ConfirmHost, ToastHost } from '@/components/ui';
import { detectLang } from '@/i18n';
import { useStore } from '@/store';
import { useColors, useIsDark } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);
  const seeded = useStore((s) => s.seeded);
  const dark = useIsDark();
  const c = useColors();

  useEffect(() => {
    if (useStore.persist.hasHydrated()) useStore.getState().setHydrated();
    // If storage is unavailable (private mode, corrupted data) still let the app open.
    const t = setTimeout(() => useStore.getState().setHydrated(), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!seeded) useStore.getState().firstRun(detectLang());
    SplashScreen.hideAsync().catch(() => {});
  }, [hydrated, seeded]);

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.card, text: c.text, border: c.border, primary: c.primary },
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="recipe/edit" />
        <Stack.Screen name="import" />
        <Stack.Screen name="cookbook/[id]" />
        <Stack.Screen name="cook/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
      {Platform.OS !== 'web' ? <IncomingShare /> : null}
      <ConfirmHost />
      <ToastHost />
    </ThemeProvider>
  );
}
