import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { MAX_WIDTH, radius, space, tintFor, useColors, useIsDark } from '@/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

const VARIANTS = {
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, lineHeight: 34 },
  h2: { fontSize: 19, fontWeight: '700', lineHeight: 25 },
  h3: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 16, lineHeight: 23 },
  sub: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: 16 },
} as const satisfies Record<string, TextStyle>;

export function Txt({
  v = 'body',
  color,
  style,
  ...rest
}: TextProps & { v?: keyof typeof VARIANTS; color?: string }) {
  const c = useColors();
  const base = v === 'sub' || v === 'small' || v === 'label' ? c.sub : c.text;
  return <Text {...rest} style={[VARIANTS[v], { color: color ?? base }, style]} />;
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[{ flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' }, style]}>{children}</View>
    </View>
  );
}

export function Header({
  title,
  back,
  right,
  large,
  onBack,
}: {
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
  large?: boolean;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.sm }}>
        {back ? <IconBtn name="chevron-back" onPress={goBack} label="Back" /> : null}
        <View style={{ flex: 1 }}>
          {title ? (
            <Txt v={large ? 'title' : 'h2'} numberOfLines={1} accessibilityRole="header">
              {title}
            </Txt>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>{right}</View>
      </View>
    </View>
  );
}

export function IconBtn({
  name,
  onPress,
  label,
  color,
  size = 22,
  filled,
  disabled,
}: {
  name: IconName;
  onPress?: () => void;
  label: string;
  color?: string;
  size?: number;
  filled?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: filled ? c.card : 'transparent', opacity: disabled ? 0.35 : pressed ? 0.6 : 1 },
        filled && { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
      ]}>
      <Ionicons name={name} size={size} color={color ?? c.text} />
    </Pressable>
  );
}

export function Btn({
  title,
  onPress,
  icon,
  variant = 'primary',
  small,
  disabled,
  loading,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useColors();
  const bg = variant === 'primary' ? c.primary : variant === 'secondary' ? c.chip : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : variant === 'danger' ? c.danger : variant === 'ghost' ? c.primary : c.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          minHeight: small ? 38 : 48,
          paddingHorizontal: small ? space.md : space.lg,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        variant === 'danger' && { borderWidth: 1, borderColor: c.danger },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 19} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: small ? 14 : 16, fontWeight: '700' }} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? c.primary : c.chip, opacity: pressed ? 0.7 : 1 },
      ]}>
      {icon ? <Ionicons name={icon} size={14} color={selected ? c.onPrimary : c.sub} /> : null}
      <Text style={{ color: selected ? c.onPrimary : c.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useColors();
  const base: StyleProp<ViewStyle> = [
    { backgroundColor: c.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: space.lg },
    style,
  ];
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [base, { opacity: pressed ? 0.8 : 1 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

export function Field({
  label,
  hint,
  style,
  ...rest
}: TextInputProps & { label?: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt v="label">{label}</Txt> : null}
      <TextInput
        placeholderTextColor={c.sub}
        accessibilityLabel={label}
        {...rest}
        style={[
          styles.input,
          { backgroundColor: c.card, borderColor: c.border, color: c.text },
          rest.multiline && { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
          style,
        ]}
      />
      {hint ? <Txt v="small">{hint}</Txt> : null}
    </View>
  );
}

export function Empty({
  icon,
  title,
  body,
  children,
}: {
  icon: IconName;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: space.md }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={32} color={c.primary} />
      </View>
      <Txt v="h2" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {body ? (
        <Txt v="sub" style={{ textAlign: 'center', maxWidth: 340 }}>
          {body}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.chip, borderRadius: radius.md, padding: 3 }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 6,
              borderRadius: radius.md - 2,
              alignItems: 'center',
              backgroundColor: on ? c.card : 'transparent',
            }}>
            <Text numberOfLines={1} style={{ color: on ? c.text : c.sub, fontWeight: on ? '700' : '500', fontSize: 14 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Check({
  checked,
  onPress,
  label,
  sub,
  strike,
  right,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  sub?: string;
  strike?: boolean;
  right?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: checked ? c.accent : c.border,
            backgroundColor: checked ? c.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: checked && strike ? c.sub : c.text,
              fontSize: 16,
              lineHeight: 22,
              textDecorationLine: checked && strike ? 'line-through' : 'none',
            }}>
            {label}
          </Text>
          {sub ? <Txt v="small">{sub}</Txt> : null}
        </View>
      </Pressable>
      {right}
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: c.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: '86%',
            width: '100%',
            maxWidth: MAX_WIDTH,
            alignSelf: 'center',
            paddingBottom: insets.bottom + space.md,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, paddingBottom: space.sm }}>
            <Txt v="h2" style={{ flex: 1 }} accessibilityRole="header">
              {title ?? ''}
            </Txt>
            <IconBtn name="close" onPress={onClose} label="Close" />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MenuRow({
  icon,
  title,
  sub,
  onPress,
  danger,
  right,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        opacity: pressed ? 0.6 : 1,
      })}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: danger ? 'transparent' : c.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={20} color={danger ? c.danger : c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="h3" color={danger ? c.danger : undefined}>
          {title}
        </Txt>
        {sub ? <Txt v="sub">{sub}</Txt> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.sub} /> : null)}
    </Pressable>
  );
}

export function RecipeImage({
  uri,
  title,
  style,
  iconSize = 28,
}: {
  uri?: string;
  title: string;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}) {
  const dark = useIsDark();
  const c = useColors();
  const [failed, setFailed] = React.useState(false);
  if (uri && !failed) {
    return (
      <View style={[{ overflow: 'hidden', backgroundColor: tintFor(title, dark) }, style]}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
          accessibilityLabel={title}
        />
      </View>
    );
  }
  return (
    <View style={[{ backgroundColor: tintFor(title, dark), alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name="restaurant-outline" size={iconSize} color={c.sub} />
    </View>
  );
}

/** Works on web too, where Alert.alert with buttons does nothing. */
export function confirm(title: string, body: string, okLabel: string, cancelLabel: string, destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(body ? `${title}\n\n${body}` : title) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, body, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

interface ToastState {
  message: string | null;
  seq: number;
  show: (m: string) => void;
  hide: () => void;
}
const useToast = create<ToastState>((set) => ({
  message: null,
  seq: 0,
  show: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  hide: () => set({ message: null }),
}));

export const toast = (message: string) => useToast.getState().show(message);

export function ToastHost() {
  const { message, seq, hide } = useToast();
  const insets = useSafeAreaInsets();
  const c = useColors();
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 2600);
    return () => clearTimeout(t);
  }, [message, seq, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 84, alignItems: 'center', paddingHorizontal: space.lg }}>
      <View
        accessibilityLiveRegion="polite"
        style={{ backgroundColor: c.text, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: space.lg, maxWidth: 480 }}>
        <Text style={{ color: c.bg, fontWeight: '600', fontSize: 14, textAlign: 'center' }}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, minHeight: 46 },
});
