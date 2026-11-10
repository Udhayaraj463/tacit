// 首頁：回到家的感覺。打招呼 → 上次的櫃檯（大照片 + 開始）→ 換一種櫃檯（橫向滑）→ 叫號、最近。
// 一進來就能按「開始」，不用先填任何東西。
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORES } from '../core/cards';
import { loadSessions } from '../state/records-store';
import { recentLine, type Session } from '../state/session-log';
import { useSettings } from '../state/settings';
import { Button, Caption, Group, Hint, Icon, Label, Row, Sheet } from '../ui/components';
import { formatWhen, greeting } from '../ui/format';
import { Mark } from '../ui/Mark';
import { useSignFace } from '../ui/sign-font';
import { StorePhoto } from '../ui/StoreCard';
import { radius, space, type, useColors, useGutter } from '../ui/theme';

export default function HomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const gutter = useGutter();
  const face = useSignFace();
  const [callSheet, setCallSheet] = useState(false);
  const [last, setLast] = useState<Session | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSessions().then((all) => setLast(all[0] ?? null));
    }, []),
  );

  const stores = STORES.filter((s) => !settings.hiddenStores.includes(s.id));
  const current = stores.find((s) => s.id === settings.lastStore) ?? stores[0];
  const lastStore = last && STORES.find((s) => s.id === last.store);
  const callText = settings.callNumber ? `等 ${settings.callNumber} 號` : settings.callName ? `等「${settings.callName}」` : '還沒設定，點這裡填號碼或名字';
  const input = [styles.input, { color: c.ink, borderColor: c.control, backgroundColor: c.surface }];
  const side = { paddingLeft: Math.max(insets.left, gutter), paddingRight: Math.max(insets.right, gutter) };

  return (
    <ScrollView style={{ backgroundColor: c.ground }} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxl }]}>
      <StatusBar style="auto" />

      {/* 最上面：產品名字、設定 */}
      <View style={[styles.topBar, side]}>
        <Mark size={28} />
        <Text style={[styles.wordmark, face, { color: c.ink }]}>看得見的對話</Text>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="設定"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: c.raised }]}
        >
          <Icon name="settings-outline" size={22} color={c.ink} />
        </Pressable>
      </View>

      <View style={[styles.greeting, side]}>
        <Text style={[styles.hello, { color: c.ink }]} role="heading" aria-level={1}>
          {greeting()}
          {settings.introName ? `，${settings.introName}` : ''}
        </Text>
        <Text style={[styles.question, { color: c.mute }]}>今天要去哪裡？</Text>
      </View>

      {/* 主角：上次選的櫃檯，直接開始 */}
      {current && (
        <View style={side}>
          <View style={[styles.hero, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.heroPhoto, { backgroundColor: c.raised }]}>
              <StorePhoto id={current.id} iconSize={64} />
            </View>
            <View style={styles.heroBody}>
              <View style={styles.heroText}>
                <Text style={[styles.heroName, { color: c.ink }]}>{current.name}</Text>
                <Text style={[styles.heroHint, { color: c.mute }]}>常問：{current.hint}</Text>
              </View>
              <Button label="開始櫃檯模式" variant="primary" size="lg" onPress={() => router.push('/counter')} />
              <Hint>{settings.holdMode === 'hand' ? '選好答案後，把手機轉過去給店員看。' : '手機平放在櫃檯上，黑色那半朝店員。'}</Hint>
            </View>
          </View>
        </View>
      )}

      {/* 換一種櫃檯：橫向滑 */}
      <View style={styles.section}>
        <View style={side}>
          <Caption>換一種櫃檯</Caption>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.strip, side]}>
          {stores.map((s) => {
            const on = s.id === current?.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => update({ lastStore: s.id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={s.name}
                style={({ pressed }) => [styles.mini, pressed && { opacity: 0.8 }]}
              >
                <View style={[styles.miniPhotoWrap, { borderColor: on ? c.ink : 'transparent' }]}>
                  <View style={[styles.miniPhoto, { backgroundColor: c.raised }]}>
                    <StorePhoto id={s.id} iconSize={28} />
                  </View>
                </View>
                <Text style={[styles.miniName, { color: on ? c.ink : c.mute, fontWeight: on ? '500' : '400' }]} numberOfLines={1}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={side}>
        <Group>
          <Row first icon="notifications-outline" title="叫號提醒" subtitle={callText} trailing="chevron" onPress={() => setCallSheet(true)} />
          {last && lastStore ? (
            <Row
              icon="time-outline"
              title={`最近・${lastStore.name}・${formatWhen(last.id)}`}
              subtitle={recentLine(last)}
              trailing="chevron"
              onPress={() => router.push('/records')}
            />
          ) : (
            <Row icon="time-outline" title="紀錄" subtitle="用過一次，最近的問答會出現在這裡" trailing="chevron" onPress={() => router.push('/records')} />
          )}
        </Group>
      </View>

      <Sheet visible={callSheet} onClose={() => setCallSheet(false)} title="叫號提醒">
        <Hint>店員喊到時，手機會震動、整個畫面變橘。手機要亮著、放在桌上。</Hint>
        <View style={styles.fields}>
          <View style={styles.field}>
            <Label>號碼</Label>
            <TextInput
              value={settings.callNumber}
              onChangeText={(v) => update({ callNumber: v.replace(/\D/g, '').slice(0, 5) })}
              placeholder="例如 42"
              placeholderTextColor={c.mute}
              inputMode="numeric"
              keyboardType="number-pad"
              accessibilityLabel="叫號號碼"
              style={input}
            />
          </View>
          <View style={styles.field}>
            <Label>或名字</Label>
            <TextInput
              value={settings.callName}
              onChangeText={(v) => update({ callName: v.slice(0, 10) })}
              placeholder="例如 陳小明"
              placeholderTextColor={c.mute}
              accessibilityLabel="叫號名字"
              style={input}
            />
          </View>
        </View>
        <View style={styles.row}>
          {(settings.callNumber || settings.callName) && (
            <Button label="清除" variant="secondary" onPress={() => update({ callNumber: '', callName: '' })} style={styles.flex} />
          )}
          <Button label="完成" variant="primary" onPress={() => setCallSheet(false)} style={styles.flex} />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const MINI = 104;

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  content: { gap: space.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  wordmark: { flex: 1, fontSize: 17, fontWeight: '500', letterSpacing: 1 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  greeting: { gap: space.xs },
  hello: { fontSize: 30, fontWeight: '500', lineHeight: 38 },
  question: { fontSize: 18, lineHeight: 26 },
  hero: { borderWidth: 1, borderRadius: radius.card + 4, overflow: 'hidden' },
  heroPhoto: { width: '100%', aspectRatio: 3 / 2, overflow: 'hidden' },
  heroBody: { padding: space.lg, gap: space.md },
  heroText: { gap: 2 },
  heroName: { fontSize: 22, fontWeight: '500', lineHeight: 30 },
  heroHint: { fontSize: type.label },
  section: { gap: space.sm },
  strip: { gap: space.md },
  mini: { width: MINI, gap: space.sm },
  miniPhotoWrap: { borderWidth: 2, borderRadius: radius.card + 4, padding: 2 },
  miniPhoto: { width: '100%', aspectRatio: 1, borderRadius: radius.card + 1, overflow: 'hidden' },
  miniName: { fontSize: type.label, textAlign: 'center' },
  fields: { flexDirection: 'row', gap: space.md },
  field: { flex: 1, minWidth: 0, gap: space.sm },
  input: { borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: 48, fontSize: type.body },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
