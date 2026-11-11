import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useStore } from '@/store';
import { useColors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ on, off, color, focused, size }: { on: IconName; off: IconName; color: ColorValue; focused: boolean; size: number }) {
  return <Ionicons name={focused ? on : off} size={size} color={color as string} />;
}

type IconProps = { color: ColorValue; focused: boolean; size: number };

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
          height: 66 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tab_recipes'), tabBarIcon: (p: IconProps) => <TabIcon on="restaurant" off="restaurant-outline" {...p} /> }} />
      <Tabs.Screen name="cookbooks" options={{ title: t('tab_cookbooks'), tabBarIcon: (p: IconProps) => <TabIcon on="book" off="book-outline" {...p} /> }} />
      <Tabs.Screen name="plan" options={{ title: t('tab_plan'), tabBarIcon: (p: IconProps) => <TabIcon on="calendar" off="calendar-outline" {...p} /> }} />
      <Tabs.Screen
        name="groceries"
        options={{
          title: t('tab_groceries'),
          tabBarIcon: (p: IconProps) => <TabIcon on="cart" off="cart-outline" {...p} />,
          tabBarBadge: left > 0 ? left : undefined,
          tabBarBadgeStyle: { backgroundColor: c.primary, color: c.onPrimary, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="settings" options={{ title: t('tab_settings'), tabBarIcon: (p: IconProps) => <TabIcon on="settings" off="settings-outline" {...p} /> }} />
    </Tabs>
  );
}
