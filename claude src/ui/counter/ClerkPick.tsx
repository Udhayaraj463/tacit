// 店員點選模式（SPEC §5.6）：太吵、辨識不到時，整個畫面翻給店員，讓他自己點「我在問什麼」。
// 金額用我們自己畫的數字鍵盤（系統鍵盤不能跟著翻轉），店員按出數字，客人那面確認——不會聽錯。
// 只有最底下一條沒有翻轉，留給客人自己取消。
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pressKey } from '../../core/keypad';
import type { Card } from '../../core/types';
import { Icon } from '../components';
import { useSignFace } from '../sign-font';
import { fonts, radius, sign, space } from '../theme';

const tile = '#1C1C1E';
const tilePressed = '#2C2C2E';
const tileEdge = '#3A3A3C';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'] as const;

export function ClerkPick({
  visible,
  cards,
  onPick,
  onAmount,
  onCancel,
  upright,
}: {
  upright?: boolean;
  visible: boolean;
  cards: Card[];
  onPick: (card: Card) => void;
  onAmount: (value: number) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const face = useSignFace();
  const [view, setView] = useState<'grid' | 'amount'>('grid');
  const [digits, setDigits] = useState('');

  const close = () => {
    setView('grid');
    setDigits('');
    onCancel();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        {/* 翻給店員看的部分：旋轉 180°，所以他的「上」是手機的下緣 */}
        <View
          style={[
            styles.clerk,
            upright
              ? { transform: [], paddingTop: insets.top + space.lg, paddingBottom: space.lg }
              : { paddingTop: insets.bottom + space.lg, paddingBottom: insets.top + space.lg },
          ]}
        >
          <View style={styles.head}>
            <Text style={[styles.label, face]}>{view === 'grid' ? '太吵了也沒關係' : '請用按的'}</Text>
            <Text style={[styles.title, face]}>{view === 'grid' ? '請點您要問的問題' : '請輸入金額'}</Text>
          </View>

          {view === 'grid' ? (
            <ScrollView contentContainerStyle={styles.grid}>
              <View style={styles.cell}>
                <Pressable
                  onPress={() => setView('amount')}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.tile, styles.amountTile, pressed && { backgroundColor: tilePressed }]}
                >
                  <Icon name="keypad-outline" size={26} color={sign.hue} />
                  <Text style={[styles.tileText, face, { color: sign.hue }]}>輸入金額</Text>
                </Pressable>
              </View>
              {cards.map((card) => (
                <View key={card.id} style={styles.cell}>
                  <Pressable
                    onPress={() => onPick(card)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.tile, pressed && { backgroundColor: tilePressed }]}
                  >
                    <Text style={[styles.tileText, face]} numberOfLines={2}>
                      {card.question}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.keypadWrap}>
              <View style={styles.display}>
                <Text style={[styles.currency, face]}>NT$</Text>
                <Text style={styles.figure} numberOfLines={1} adjustsFontSizeToFit>
                  {digits ? Number(digits).toLocaleString('zh-TW') : '0'}
                </Text>
                <Text style={[styles.currency, face]}>元</Text>
              </View>
              <View style={styles.keys}>
                {KEYS.map((k) => (
                  <View key={k} style={styles.keyCell}>
                    <Pressable
                      onPress={() => setDigits((d) => pressKey(d, k))}
                      accessibilityRole="button"
                      accessibilityLabel={k === 'del' ? '刪除' : k === 'clear' ? '清除' : k}
                      style={({ pressed }) => [styles.key, pressed && { backgroundColor: tilePressed }]}
                    >
                      {k === 'del' ? (
                        <Icon name="backspace-outline" size={26} color={sign.fg} />
                      ) : (
                        <Text style={[k === 'clear' ? styles.keyWord : styles.keyDigit, k === 'clear' && face]}>{k === 'clear' ? '清除' : k}</Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
              <View style={styles.row}>
                <Pressable
                  onPress={() => {
                    setView('grid');
                    setDigits('');
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.action, styles.actionGhost, pressed && { backgroundColor: tilePressed }]}
                >
                  <Text style={[styles.actionText, face]}>回到問題</Text>
                </Pressable>
                <Pressable
                  disabled={!digits}
                  onPress={() => {
                    onAmount(Number(digits));
                    setView('grid');
                    setDigits('');
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.action, styles.actionHue, { opacity: digits ? (pressed ? 0.85 : 1) : 0.4 }]}
                >
                  <Text style={[styles.actionText, face, { color: sign.onHue }]}>給客人確認</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* 客人這一側：沒有翻轉 */}
        <Pressable
          onPress={close}
          accessibilityRole="button"
          style={({ pressed }) => [styles.userBar, { paddingBottom: Math.max(insets.bottom, space.md) }, pressed && { opacity: 0.7 }]}
        >
          <Icon name="swap-vertical-outline" size={18} color={sign.mute} />
          <Text style={styles.userBarText}>取消，回到我這面</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: sign.bg },
  clerk: { flex: 1, transform: [{ rotate: '180deg' }], paddingHorizontal: space.lg, gap: space.lg },
  head: { gap: space.xs, paddingHorizontal: space.xs },
  label: { color: sign.hue, fontSize: 16 },
  title: { color: sign.fg, fontSize: 32, lineHeight: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -space.xs, paddingBottom: space.lg },
  cell: { width: '50%', padding: space.xs },
  tile: {
    // 固定高度：兩行的問題和一行的問題同一排對齊
    height: 100,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: tileEdge,
    backgroundColor: tile,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    justifyContent: 'center',
  },
  amountTile: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderColor: sign.hue },
  tileText: { color: sign.fg, fontSize: 24, lineHeight: 31 },
  keypadWrap: { flex: 1, gap: space.lg },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: tile,
    borderRadius: radius.card,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
  },
  currency: { color: sign.mute, fontSize: 20 },
  figure: { color: sign.fg, fontFamily: fonts.numeric, fontSize: 56, flexShrink: 1 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', margin: -space.xs },
  keyCell: { width: '33.333%', padding: space.xs },
  key: {
    minHeight: 60,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: tileEdge,
    backgroundColor: tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDigit: { color: sign.fg, fontFamily: fonts.numeric, fontSize: 28 },
  keyWord: { color: sign.fg, fontSize: 18 },
  row: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, minHeight: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  actionGhost: { borderWidth: 1, borderColor: tileEdge },
  actionHue: { backgroundColor: sign.hue },
  actionText: { color: sign.fg, fontSize: 18 },
  userBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: tileEdge,
    minHeight: 52,
  },
  userBarText: { color: sign.mute, fontSize: 15 },
});
