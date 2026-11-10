// 設定（SPEC §5.3）。每個控制項改了就存，全部只存在這支手機。
import { useState, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { STORES } from "../core/cards";
import { DEFAULT_INTRO } from "../i18n/zh-TW";
import { clearSessions } from "../state/records-store";
import { useSettings, type Haptics } from "../state/settings";
import { Button, Group, Hint, Label, Row, Segmented } from "../ui/components";
import { signLines } from "../core/sign-text";
import { speak } from "../platform/feedback";
import { SpeakButton } from "../ui/counter/ClerkPanel";
import { useSignFace } from "../ui/sign-font";
import { storeIcon } from "../ui/store-icons";
import {
  radius,
  sign,
  space,
  type,
  useColors,
  useGutter,
  type FontScaleIndex,
} from "../ui/theme";

const INTROS = [
  DEFAULT_INTRO,
  "我聽力不好，請對著手機說話",
  "我用文字溝通，請看螢幕",
  "我拿掉耳機就聽不到，不用跟我聊天，謝謝",
];
const SCALES: { v: FontScaleIndex; label: string }[] = [
  { v: 0, label: "標準" },
  { v: 1, label: "大" },
  { v: 2, label: "特大" },
];
const HAPTICS: { v: Haptics; label: string }[] = [
  { v: "off", label: "關" },
  { v: "light", label: "弱" },
  { v: "strong", label: "強" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text
          style={[styles.sectionTitle, { color: c.ink }]}
          role="heading"
          aria-level={2}
        >
          {title}
        </Text>
        {!!description && (
          <Text style={[styles.sectionDesc, { color: c.mute }]}>
            {description}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

function Panel({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      {children}
    </View>
  );
}

function SwitchRow({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchTitle, { color: c.ink }]}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.primary, false: c.control }}
        thumbColor={c.surface}
        {...({ activeThumbColor: c.surface } as object)}
        accessibilityLabel={title}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const gutter = useGutter();
  const face = useSignFace();
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);
  const custom = !INTROS.includes(settings.introText);
  const input = [
    styles.input,
    { color: c.ink, borderColor: c.control, backgroundColor: c.surface },
  ];
  const shownCount = STORES.length - settings.hiddenStores.length;

  return (
    <ScrollView
      style={{ backgroundColor: c.ground }}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Section
        title="給店員看的第一句話"
        description="一進櫃檯模式，翻過去的那一面就顯示這句。"
      >
        <View style={[styles.preview, { backgroundColor: sign.bg }]}>
          <Text style={[styles.previewText, face]} numberOfLines={3}>
            {signLines(settings.introText)}
          </Text>
          <Text style={[styles.previewSub, face]}>
            {settings.introName
              ? `您好，我是${settings.introName}`
              : "我會用螢幕回答您"}
          </Text>
          <View style={styles.previewSpeak}>
            <SpeakButton
              onPress={() =>
                speak(
                  settings.introName
                    ? `您好，我是${settings.introName}。${settings.introText}`
                    : settings.introText,
                )
              }
            />
          </View>
        </View>
        <Group>
          {INTROS.map((t, i) => (
            <Row
              key={t}
              first={i === 0}
              title={t}
              trailing="check"
              selected={settings.introText === t}
              onPress={() => update({ introText: t })}
            />
          ))}
        </Group>
        <View style={styles.field}>
          <Label>或自己寫一句</Label>
          <TextInput
            value={custom ? settings.introText : ""}
            onChangeText={(v) =>
              update({ introText: v.slice(0, 40) || DEFAULT_INTRO })
            }
            placeholder="最多 40 個字"
            placeholderTextColor={c.mute}
            accessibilityLabel="自訂第一句話"
            style={input}
          />
        </View>
        <View style={styles.field}>
          <Label>你的名字（可以不填）</Label>
          <TextInput
            value={settings.introName}
            onChangeText={(v) => update({ introName: v.slice(0, 12) })}
            placeholder="例如 小明"
            placeholderTextColor={c.mute}
            accessibilityLabel="名字"
            style={input}
          />
        </View>
      </Section>

      <Section
        title="使用方式"
        description="拿著：選好答案後，把手機轉過去給店員看。平放：手機放在櫃檯上，上半部翻給店員看。"
      >
        <Panel>
          <Segmented
            items={[
              { v: "hand" as const, label: "拿在手上" },
              { v: "flat" as const, label: "平放在櫃檯" },
            ]}
            value={settings.holdMode}
            onChange={(v) => update({ holdMode: v })}
          />
        </Panel>
      </Section>

      <Section
        title="聽與說"
        description="辨識與唸出來都用手機內建的功能，錄音不會保存。"
      >
        <Panel>
          <SwitchRow
            title="進入櫃檯模式就開始聽"
            value={settings.autoListen}
            onChange={(v) => update({ autoListen: v })}
          />
          <View style={[styles.rule, { backgroundColor: c.rule }]} />
          <SwitchRow
            title="我要說的話，自動唸給店員聽"
            value={settings.ttsAuto}
            onChange={(v) => update({ ttsAuto: v })}
          />
        </Panel>
      </Section>

      <Section
        title="雲端判斷"
        description="手機聽不懂店員在問什麼時，把那一句話送到 Google Gemini 判斷。iPhone 網頁版不能語音辨識時，改成錄下店員的話送過去轉成文字。錄音和文字用完就丟，我們不保存；但打開後，店員的話會離開這支手機。"
      >
        <Panel>
          <SwitchRow
            title="使用雲端判斷（Gemini）"
            value={settings.cloudHelp}
            onChange={(v) => update({ cloudHelp: v })}
          />
        </Panel>
      </Section>

      <Section
        title="字體大小"
        description="兩面分開調：店員那面在一公尺外看，你這面在手邊看。"
      >
        <Panel>
          <Label>我這一面</Label>
          <Segmented
            items={SCALES}
            value={settings.fontScaleUser}
            onChange={(v) => update({ fontScaleUser: v })}
          />
          <View style={styles.gap} />
          <Label>店員那一面</Label>
          <Segmented
            items={SCALES}
            value={settings.fontScaleClerk}
            onChange={(v) => update({ fontScaleClerk: v })}
          />
        </Panel>
      </Section>

      <Section
        title="震動"
        description="叫號提醒也跟著這裡。關掉時，叫號仍會整個畫面變橘。"
      >
        <Panel>
          <Segmented
            items={HAPTICS}
            value={settings.haptics}
            onChange={(v) => update({ haptics: v })}
          />
        </Panel>
      </Section>

      <Section
        title="顯示哪些櫃檯"
        description={`首頁和櫃檯模式裡只列打勾的。現在顯示 ${shownCount} 種，至少要留一種。`}
      >
        <Group>
          {STORES.map((s, i) => {
            const shown = !settings.hiddenStores.includes(s.id);
            return (
              <Row
                key={s.id}
                first={i === 0}
                icon={storeIcon(s.id)}
                title={s.name}
                trailing="check"
                selected={shown}
                onPress={() => {
                  if (shown && shownCount <= 1) return;
                  update({
                    hiddenStores: shown
                      ? [...settings.hiddenStores, s.id]
                      : settings.hiddenStores.filter((x) => x !== s.id),
                  });
                }}
              />
            );
          })}
        </Group>
      </Section>

      <Section
        title="資料"
        description="對話紀錄和用法用量只存在這支手機，不會上傳。"
      >
        {cleared ? (
          <Hint>已清除所有紀錄。</Hint>
        ) : confirmClear ? (
          <Panel>
            <Text style={[styles.switchTitle, { color: c.ink }]}>
              確定要清除所有紀錄嗎？存下來的用法用量也會一起刪掉，無法復原。
            </Text>
            <View style={styles.row}>
              <Button
                label="清除"
                variant="danger"
                onPress={async () => {
                  await clearSessions();
                  setConfirmClear(false);
                  setCleared(true);
                }}
                style={styles.flex}
              />
              <Button
                label="取消"
                variant="secondary"
                onPress={() => setConfirmClear(false)}
                style={styles.flex}
              />
            </View>
          </Panel>
        ) : (
          <Button
            label="清除所有紀錄"
            variant="danger"
            onPress={() => setConfirmClear(true)}
            style={styles.selfStart}
          />
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  previewSpeak: { marginTop: space.md, alignItems: "flex-start" },
  content: { paddingTop: space.lg, gap: space.xxl },
  section: { gap: space.md },
  sectionHead: { gap: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "500" },
  sectionDesc: { fontSize: type.label, lineHeight: 20 },
  panel: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
  preview: {
    borderRadius: radius.card,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    gap: 6,
  },
  previewText: {
    color: sign.fg,
    fontSize: 20,
    fontWeight: "500",
    lineHeight: 26,
  },
  previewSub: { color: sign.mute, fontSize: type.label },
  field: { gap: space.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    minHeight: 48,
    fontSize: type.body,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    minHeight: 48,
  },
  switchTitle: {
    fontSize: type.body,
    fontWeight: "500",
    flexShrink: 1,
    lineHeight: 22,
  },
  rule: { height: 1, marginVertical: space.xs },
  gap: { height: space.sm },
  row: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  flex: { flex: 1 },
  selfStart: { alignSelf: "flex-start" },
});
