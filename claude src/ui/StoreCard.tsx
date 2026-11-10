// 情境卡：上半是這種櫃檯的照片（同一個 4:3 裁切、同一種色調），下半是名字和常問的事。
// 選中時邊框變成近黑、照片右上角一個打勾；不用顏色、不用粗體。
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { Store } from '../core/types';
import { Icon } from './components';
import { storeIcon } from './store-icons';
import { radius, space, type, useColors } from './theme';

export const PHOTOS: Record<string, ImageSourcePropType> = {
  cvs: require('../../assets/stores/cvs.jpg'),
  drink: require('../../assets/stores/drink.jpg'),
  breakfast: require('../../assets/stores/breakfast.jpg'),
  pharmacy: require('../../assets/stores/pharmacy.jpg'),
  market: require('../../assets/stores/market.jpg'),
  buffet: require('../../assets/stores/buffet.jpg'),
  salon: require('../../assets/stores/salon.jpg'),
  other: require('../../assets/stores/other.jpg'),
};

/** 情境照片；還沒有照片的櫃檯先放圖示 */
export function StorePhoto({ id, iconSize = 40 }: { id: string; iconSize?: number }) {
  const c = useColors();
  return PHOTOS[id] ? (
    <Image source={PHOTOS[id]} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors />
  ) : (
    <View style={[styles.fill, styles.iconFill]}>
      <Icon name={storeIcon(id)} size={iconSize} color={c.mute} />
    </View>
  );
}

export function StoreCard({
  store,
  selected,
  onPress,
  compact,
}: {
  store: Store;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${store.name}，常問${store.hint}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? c.raised : c.surface,
          borderColor: selected ? c.ink : c.border,
          borderWidth: selected ? 2 : 1,
          // 邊框變粗時往內收 1px，卡片大小不變，版面不跳
          margin: selected ? 0 : 1,
        },
      ]}
    >
      <View style={[styles.photoWrap, compact && styles.photoCompact, { backgroundColor: c.raised }]}>
        <StorePhoto id={store.id} />
        {selected && (
          <View style={[styles.check, { backgroundColor: c.primary }]}>
            <Icon name="checkmark" size={16} color={c.onPrimary} />
          </View>
        )}
      </View>
      <View style={[styles.text, compact && styles.textCompact]}>
        <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
          {store.name}
        </Text>
        {!compact && (
          <Text style={[styles.hint, { color: c.mute }]} numberOfLines={1}>
            {store.hint}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** 兩欄（compact 時三欄）的情境卡格子 */
export function StoreGrid({
  stores,
  selectedId,
  onSelect,
  compact,
}: {
  stores: Store[];
  selectedId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const cols = compact ? 3 : 2;
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {stores.map((s) => (
        <View key={s.id} style={{ width: `${100 / cols}%`, padding: space.xs + 2 }}>
          <StoreCard store={s} selected={s.id === selectedId} onPress={() => onSelect(s.id)} compact={compact} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  iconFill: { alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.card + 2, overflow: 'hidden' },
  photoWrap: { aspectRatio: 4 / 3, width: '100%', overflow: 'hidden' },
  photoCompact: { aspectRatio: 1 },
  check: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { paddingHorizontal: space.md, paddingTop: space.sm + 2, paddingBottom: space.md, gap: 2 },
  textCompact: { paddingVertical: space.sm, alignItems: 'center' },
  name: { fontSize: type.body + 1, fontWeight: '500' },
  hint: { fontSize: type.small },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -(space.xs + 2) },
});
