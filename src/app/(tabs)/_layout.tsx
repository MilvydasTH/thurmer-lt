import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useStore } from '@/store';
import { useColors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? on : off} size={size} color={color as string} />
  );

export default function TabsLayout() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const left = useStore((s) => s.groceries.filter((g) => !g.checked).length);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.sub,
        // Explicit height: the default bar clips its labels on web.
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tab_recipes'), tabBarIcon: icon('restaurant', 'restaurant-outline') }} />
      <Tabs.Screen name="cookbooks" options={{ title: t('tab_cookbooks'), tabBarIcon: icon('book', 'book-outline') }} />
      <Tabs.Screen name="plan" options={{ title: t('tab_plan'), tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen
        name="groceries"
        options={{
          title: t('tab_groceries'),
          tabBarIcon: icon('cart', 'cart-outline'),
          tabBarBadge: left > 0 ? left : undefined,
          tabBarBadgeStyle: { backgroundColor: c.primary, color: c.onPrimary, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="settings" options={{ title: t('tab_settings'), tabBarIcon: icon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
