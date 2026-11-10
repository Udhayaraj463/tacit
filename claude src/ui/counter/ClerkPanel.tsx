// 店員面：手機平放時朝向店員，所以整塊旋轉 180°。
// 排版照告示牌：暖橘的小標說「這是什麼」，白色大字是內容，灰字是補充。
// 字體用思源黑體 Medium（使用者選的）：筆畫乾淨，不用加粗就夠清楚。
// 字檔約 7MB，背景載入；載好之前先用系統字體，不讓畫面等它。
// 在逗號處自己斷行（告示牌不留行尾標點），不讓兩個字掉到下一行。
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { ClerkView } from "../../core/counter-machine";
import { signLines } from "../../core/sign-text";
import { useSignFace } from "../sign-font";
import { fonts, sign, space } from "../theme";

const clamp = (min: number, v: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * upright：「拿著」模式的全螢幕大字卡。不翻轉（手機轉過去給店員看時字就是正的），字也更大。
 */
export function ClerkPanel({
  view,
  scale,
  onClerkPick,
  onSpeak,
  upright,
}: {
  view: ClerkView;
  scale: number;
  onClerkPick?: () => void;
  /** 把這一句唸出來 */
  onSpeak?: () => void;
  upright?: boolean;
}) {
  const { width } = useWindowDimensions();
  const face = useSignFace();
  const text = view.big ? view.main : signLines(view.main);
  // 一兩個字的答案（「要」「少冰」）像招牌一樣大
  const short = !view.big && !text.includes("\n") && [...text].length <= 4;
  const size =
    (upright
      ? view.big
        ? clamp(64, width * 0.22, 140)
        : short
          ? clamp(96, width * 0.3, 180)
          : clamp(40, width * 0.12, 64)
      : view.big
        ? clamp(48, width * 0.17, 96)
        : short
          ? clamp(64, width * 0.22, 120)
          : clamp(32, width * 0.104, 52)) * scale;

  return (
    <View style={styles.panel} accessibilityLabel={`店員面：${view.main}`}>
      <View style={[styles.inner, upright && styles.upright]}>
        <Text
          style={[styles.label, face]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
        >
          {view.label}
        </Text>
        <Text
          style={[
            styles.main,
            face,
            {
              fontSize: size,
              lineHeight: Math.round(size * (short || view.big ? 1.1 : 1.22)),
            },
            view.big && styles.figure,
            view.accent && { color: sign.hue },
          ]}
          numberOfLines={view.big || short ? 1 : 3}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.2}
        >
          {text}
        </Text>
        {!!view.sub && (
          <Text
            style={[styles.sub, face]}
            numberOfLines={2}
            maxFontSizeMultiplier={1.2}
          >
            {view.sub}
          </Text>
        )}
        {(onClerkPick || onSpeak) && (
          <View style={styles.actions}>
            {onClerkPick && (
              <Pressable
                onPress={onClerkPick}
                accessibilityRole="button"
                accessibilityLabel="店員自己點選問題"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.pick,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.pickText, face]}>
                  或點這裡，選您要問的問題
                </Text>
              </Pressable>
            )}
            {onSpeak && <SpeakButton onPress={onSpeak} />}
          </View>
        )}
      </View>
      {!upright && (
        <Text style={styles.flipHint} maxFontSizeMultiplier={1}>
          這一面朝向店員
        </Text>
      )}
    </View>
  );
}

/** 店員面的「播放」：唸出大字那一句。圓形喇叭，不用識字也看得懂。 */
export function SpeakButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="唸出來"
      hitSlop={8}
      style={({ pressed }) => [styles.speak, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="volume-high" size={30} color={sign.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: sign.bg, overflow: "hidden" },
  inner: {
    flex: 1,
    transform: [{ rotate: "180deg" }],
    justifyContent: "center",
    paddingHorizontal: space.xxl - 4,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },
  upright: { transform: [], paddingBottom: space.xl },
  label: {
    color: sign.hue,
    fontSize: 17,
    fontWeight: "500",
    marginBottom: space.md,
  },
  main: { color: sign.fg, fontWeight: "500" },
  figure: { fontFamily: fonts.numeric, fontWeight: "normal" },
  sub: {
    color: sign.mute,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
    marginTop: space.md,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.lg,
  },
  speak: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: sign.mute,
  },
  pick: {
    alignSelf: "flex-start",
    minHeight: 60,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    borderRadius: 999,
    backgroundColor: sign.hue,
  },
  pickText: { color: sign.onHue, fontSize: 21 },
  flipHint: {
    position: "absolute",
    bottom: space.sm,
    alignSelf: "center",
    color: sign.mute,
    fontSize: 12,
    fontWeight: "500",
  },
});
