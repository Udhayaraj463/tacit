// 共用元件。規則：平的、不用陰影；按下時換一階灰，大小不變；顏色只給「主要動作」（近黑）與狀態。
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_TOUCH, radius, space, type, useColors, type Colors } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** 裝飾用圖示（旁邊一定有文字），對螢幕閱讀器隱藏。 */
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <Ionicons name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}

/**
 * primary：近黑填色，一個畫面一個（這個畫面最常做的事）
 * secondary：一階灰填色，沒有邊
 * outline：白底 + 控制項邊
 * ghost：只有字
 * danger：白底、紅字紅邊（否定、清除）
 */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

function variantColors(c: Colors, v: Variant) {
  switch (v) {
    case 'primary':
      return { bg: c.primary, fg: c.onPrimary, border: c.primary, pressed: c.mute };
    case 'secondary':
      return { bg: c.raised, fg: c.ink, border: c.raised, pressed: c.border };
    case 'danger':
      return { bg: c.surface, fg: c.negative, border: c.negative, pressed: c.negativeSoft };
    case 'ghost':
      return { bg: 'transparent', fg: c.ink, border: 'transparent', pressed: c.raised };
    default:
      return { bg: c.surface, fg: c.ink, border: c.control, pressed: c.raised };
  }
}

export function Button({
  label,
  onPress,
  variant = 'outline',
  icon,
  size = 'md',
  disabled,
  style,
  accessibilityLabel,
  fontSize: fontSizeOverride,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  fontSize?: number;
}) {
  const c = useColors();
  const v = variantColors(c, variant);
  const fontSize = fontSizeOverride ?? (size === 'lg' ? 18 : size === 'sm' ? 15 : 16);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed && !disabled ? v.pressed : v.bg,
          borderColor: pressed && variant === 'primary' ? v.pressed : v.border,
          minHeight: size === 'lg' ? 56 : size === 'sm' ? 44 : MIN_TOUCH,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={fontSize + 2} color={v.fg} />}
      {!!label && (
        <Text style={[styles.buttonText, { color: v.fg, fontSize }]} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** 狀態列上的小控制項：白底細邊；selected 時近黑填色。 */
export function Chip({
  label,
  onPress,
  selected,
  icon,
  dot,
  trailingIcon,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: IconName;
  dot?: 'on' | 'busy' | 'off';
  trailingIcon?: IconName;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const fg = selected ? c.onPrimary : c.ink;
  const dotColor = dot === 'on' ? c.positive : dot === 'busy' ? c.mute : c.control;
  const content = (
    <>
      {dot && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
      {icon && <Icon name={icon} size={16} color={selected ? c.onPrimary : c.mute} />}
      {!!label && (
        <Text style={[styles.chipText, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      )}
      {trailingIcon && <Icon name={trailingIcon} size={14} color={selected ? c.onPrimary : c.mute} />}
    </>
  );
  if (!onPress) return <View style={[styles.chip, { borderColor: 'transparent', paddingHorizontal: 0 }]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.primary : pressed ? c.raised : c.surface,
          borderColor: selected ? c.primary : c.border,
        },
      ]}
    >
      {content}
    </Pressable>
  );
}

/** 分段選擇：一條灰軌、選中的是白色塊。 */
export function Segmented<T extends string | number>({
  items,
  value,
  onChange,
}: {
  items: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segment, { backgroundColor: c.raised }]} accessibilityRole="radiogroup">
      {items.map((it) => {
        const on = it.v === value;
        return (
          <Pressable
            key={String(it.v)}
            onPress={() => onChange(it.v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segmentItem, on && { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={[styles.segmentText, { color: on ? c.ink : c.mute, fontWeight: on ? '500' : '400' }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 一組清單：一個白色面板，列與列之間 1px 細線。 */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

export function Row({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  selected,
  first,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  trailing?: 'chevron' | 'check' | ReactNode;
  onPress?: () => void;
  selected?: boolean;
  first?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const trail =
    trailing === 'chevron' ? (
      <Icon name="chevron-forward" size={18} color={c.mute} />
    ) : trailing === 'check' ? (
      selected ? <Icon name="checkmark" size={22} color={c.ink} /> : <View style={styles.checkSlot} />
    ) : (
      trailing
    );
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={trailing === 'check' ? 'radio' : 'button'}
      accessibilityState={trailing === 'check' ? { checked: !!selected } : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed || selected ? c.raised : 'transparent' }]}
    >
      {!first && <View style={[styles.rowRule, { backgroundColor: c.rule }]} />}
      {icon && <Icon name={icon} size={20} color={c.mute} />}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: c.ink, fontWeight: selected ? '500' : '400' }]} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.rowSub, { color: c.mute }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trail}
    </Pressable>
  );
}

/** 區塊上方的小標：13px 灰色，句子格式，不加圖示。 */
export function Caption({ children, color }: { children: ReactNode; color?: string }) {
  const c = useColors();
  return <Text style={[styles.caption, { color: color ?? c.mute }]}>{children}</Text>;
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetRoot}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="關閉" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <Text style={[styles.sheetTitle, { color: c.ink }]} role="heading" aria-level={2}>
            {title}
          </Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.label, { color: c.ink }]}>{children}</Text>;
}

export function Hint({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.hint, { color: c.mute }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  buttonText: { fontWeight: '500', textAlign: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    minHeight: 36,
  },
  chipText: { fontSize: type.label, fontWeight: '500' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  segment: { flexDirection: 'row', borderRadius: radius.control + 2, padding: 3, alignSelf: 'flex-start' },
  segmentItem: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 15 },
  group: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
  rowRule: { position: 'absolute', top: 0, left: space.lg, right: 0, height: 1 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: type.body, lineHeight: 22 },
  rowSub: { fontSize: type.small, lineHeight: 18 },
  checkSlot: { width: 22 },
  caption: { fontSize: type.small, fontWeight: '500' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: space.xs },
  sheetTitle: { fontSize: 18, fontWeight: '500' },
  label: { fontSize: type.label, fontWeight: '500' },
  hint: { fontSize: type.label, lineHeight: 21 },
});
