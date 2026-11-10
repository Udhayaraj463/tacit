// 叫號命中：全螢幕琥珀色 + 閃爍（減少動態效果時不閃）。
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components';
import { useSignFace } from '../sign-font';
import { fonts, sign, space } from '../theme';

export function CallAlert({ visible, who, onDismiss }: { visible: boolean; who: string; onDismiss: () => void }) {
  const [flash] = useState(() => new Animated.Value(1));
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible || reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      { iterations: 6 },
    );
    loop.start();
    return () => loop.stop();
  }, [visible, reduce, flash]);

  const isNumber = /^\d+$/.test(who);
  const face = useSignFace();
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      {/* 只閃背景（琥珀 ↔ 白），文字一直保持深色高對比 */}
      <View style={[styles.root, { backgroundColor: '#FFFFFF' }]} accessibilityLiveRegion="assertive">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: sign.hue, opacity: flash }]} />
        <Text style={[styles.msg, face, { color: sign.onHue }]}>到你了</Text>
        <Text
          style={[styles.big, face, { color: sign.onHue }, isNumber && { fontFamily: fonts.numeric }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {who}
        </Text>
        {isNumber && <Text style={[styles.msg, face, { color: sign.onHue }]}>號</Text>}
        <Button label="知道了" variant="primary" size="lg" onPress={onDismiss} style={styles.button} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  msg: { fontSize: 28, fontWeight: '500' },
  big: { fontSize: 120, fontWeight: '500', lineHeight: 130 },
  button: { marginTop: space.xl, minWidth: 200 },
});
