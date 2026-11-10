// 「拿著」模式：全螢幕大字卡。把手機轉過去給店員看，看完點一下收回。
// 店員的「或點這裡，選您要問的問題」放在大字卡外面（按鈕裡不能再放按鈕）。
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClerkView } from "../../core/counter-machine";
import { useSignFace } from "../sign-font";
import { sign, space } from "../theme";
import { ClerkPanel, SpeakButton } from "./ClerkPanel";

export function ShowToClerk({
  visible,
  view,
  scale,
  onDismiss,
  onClerkPick,
  onSpeak,
}: {
  visible: boolean;
  view: ClerkView;
  scale: number;
  onDismiss: () => void;
  onClerkPick: () => void;
  onSpeak: () => void;
}) {
  const insets = useSafeAreaInsets();
  const face = useSignFace();
  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, space.md),
          },
        ]}
      >
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="收回，回到我的畫面"
          style={styles.card}
        >
          <ClerkPanel view={view} scale={scale} upright />
        </Pressable>
        <View style={styles.foot}>
          <View style={styles.row}>
            <Pressable
              onPress={onClerkPick}
              accessibilityRole="button"
              accessibilityLabel="店員自己點選問題"
              style={({ pressed }) => [
                styles.pick,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.pickText, face]}>
                或點這裡，選您要問的問題
              </Text>
            </Pressable>
            <SpeakButton onPress={onSpeak} />
          </View>
          <Pressable onPress={onDismiss} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.hint}>給店員看完，點一下收回</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: sign.bg },
  card: { flex: 1 },
  foot: {
    paddingHorizontal: space.xxl - 4,
    gap: space.lg,
    paddingBottom: space.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  pick: {
    alignSelf: "flex-start",
    minHeight: 60,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    borderRadius: 999,
    backgroundColor: sign.hue,
  },
  pickText: { color: sign.onHue, fontSize: 21 },
  hint: { color: sign.mute, fontSize: 13, textAlign: "center" },
});
