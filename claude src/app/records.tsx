// 紀錄（SPEC §5.4）：先回答「藥要怎麼吃？」（存下來的用法用量），再列每一次櫃檯的問答。
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORES } from '../core/cards';
import { loadSessions } from '../state/records-store';
import { allDosages, misheardReport, summarize, type Session } from '../state/session-log';
import { Button, Hint, Icon } from '../ui/components';
import { formatWhen } from '../ui/format';
import { storeIcon } from '../ui/store-icons';
import { fonts, radius, space, type, useColors, useGutter } from '../ui/theme';

function Heading({ title, count }: { title: string; count: number }) {
  const c = useColors();
  return (
    <View style={styles.heading}>
      <Text style={[styles.headingText, { color: c.ink }]} role="heading" aria-level={2}>
        {title}
      </Text>
      <Text style={[styles.count, { color: c.mute }]}>{count} 筆</Text>
    </View>
  );
}

export default function RecordsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [shownReport, setShownReport] = useState(false);
  const gutter = useGutter();

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
    }, []),
  );

  if (!sessions) return null;
  const dosages = allDosages(sessions);
  const report = misheardReport(sessions);
  const panel = { backgroundColor: c.surface, borderColor: c.border };

  return (
    <ScrollView style={{ backgroundColor: c.ground }} contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }]}>
      <View style={styles.group}>
        <Heading title="用法用量" count={dosages.length} />
        {dosages.length === 0 ? (
          <View style={[styles.empty, { borderColor: c.control }]}>
            <Text style={[styles.emptyText, { color: c.mute }]}>還沒有存下來的用法用量。在藥局按「存下來」，就會出現在這裡。</Text>
          </View>
        ) : (
          <View style={[styles.panel, panel]}>
            {dosages.map((d, i) => (
              <View key={`${d.sessionId}-${i}`} style={[styles.dosageRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.rule }]}>
                <Text style={[styles.dosage, { color: c.ink }]}>{d.text}</Text>
                <Text style={[styles.meta, { color: c.mute }]}>{formatWhen(d.sessionId)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.group}>
        <Heading title="對話紀錄" count={sessions.length} />
        {sessions.length === 0 && (
          <View style={[styles.empty, { borderColor: c.control }]}>
            <Text style={[styles.emptyText, { color: c.mute }]}>還沒有紀錄。用過一次櫃檯模式，問答就會留在這裡。</Text>
          </View>
        )}
        {sessions.map((s) => {
          const sum = summarize(s);
          const empty = !sum.qa.length && !sum.amounts.length && !sum.typed.length;
          return (
            <View key={s.id} style={[styles.panel, panel]}>
              <View style={[styles.sessionHead, { borderBottomColor: c.rule }]}>
                <Icon name={storeIcon(s.store)} size={18} color={c.mute} />
                <Text style={[styles.store, { color: c.ink }]}>{STORES.find((x) => x.id === s.store)?.name ?? s.store}</Text>
                <Text style={[styles.meta, { color: c.mute }]}>{formatWhen(s.id)}</Text>
              </View>
              <View style={styles.sessionBody}>
                {sum.qa.map((qa, i) => (
                  <View key={i} style={styles.qa}>
                    <Text style={[styles.q, { color: c.mute }]} numberOfLines={1}>
                      {qa.q}
                    </Text>
                    <Text style={[styles.a, { color: c.ink }]} numberOfLines={1}>
                      {qa.a}
                    </Text>
                  </View>
                ))}
                {sum.amounts.map((a, i) => (
                  <View key={`a${i}`} style={styles.qa}>
                    <Text style={[styles.q, { color: c.mute }]}>{a.perJin ? '每斤' : '金額'}</Text>
                    <View style={styles.amountCell}>
                      <Text style={[styles.amount, { color: c.ink }]}>NT$ {a.value.toLocaleString('zh-TW')}</Text>
                      {a.confirmed !== undefined && (
                        <Text style={[styles.status, { color: a.confirmed ? c.positive : c.negative }]}>{a.confirmed ? '已確認' : '請重說'}</Text>
                      )}
                    </View>
                  </View>
                ))}
                {sum.typed.map((t, i) => (
                  <View key={`t${i}`} style={styles.qa}>
                    <Text style={[styles.q, { color: c.mute }]}>我打字</Text>
                    <Text style={[styles.a, { color: c.ink }]} numberOfLines={2}>
                      {t}
                    </Text>
                  </View>
                ))}
                {empty && <Text style={[styles.q, { color: c.mute }]}>這次沒有回答任何問題。</Text>}
              </View>
            </View>
          );
        })}
      </View>

      {/* 「判斷錯了」的紀錄：匯出給開發者，用來修判斷規則 */}
      <View style={styles.group}>
        <Heading title="辨識錯誤紀錄" count={report.count} />
        {report.count === 0 ? (
          <Hint>在櫃檯模式按「判斷錯了？」改正過的句子會記在這裡。匯出給開發者，可以讓判斷越來越準。</Hint>
        ) : (
          <>
            <Hint>只包含手機聽到的句子和判斷結果，長串數字（例如電話）會遮掉。</Hint>
            <Button
              label="匯出給開發者"
              icon="share-outline"
              variant="primary"
              onPress={async () => {
                try {
                  if (Platform.OS === 'web' && !(globalThis as { navigator?: { share?: unknown } }).navigator?.share) throw new Error('no share');
                  await Share.share({ message: report.text });
                } catch {
                  setShownReport(true);
                }
              }}
            />
            {shownReport && (
              <Text selectable style={[styles.reportText, { color: c.ink, backgroundColor: c.surface, borderColor: c.border }]}>
                {report.text}
              </Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  reportText: { borderWidth: 1, borderRadius: radius.card, padding: space.md, fontSize: type.small, lineHeight: 20 },
  content: { paddingTop: space.lg, gap: space.xxl },
  group: { gap: space.md },
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  headingText: { fontSize: 17, fontWeight: '500' },
  count: { fontSize: type.small, fontVariant: ['tabular-nums'] },
  panel: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, padding: space.lg },
  emptyText: { fontSize: type.label, lineHeight: 21 },
  dosageRow: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 4 },
  dosage: { fontSize: 18, fontWeight: '500', lineHeight: 26 },
  meta: { fontSize: type.small, fontVariant: ['tabular-nums'] },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1 },
  store: { flex: 1, fontSize: type.body, fontWeight: '500' },
  sessionBody: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  qa: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  q: { flex: 1, fontSize: type.label, lineHeight: 20 },
  a: { fontSize: type.body, fontWeight: '500', textAlign: 'right', maxWidth: '55%' },
  amountCell: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  amount: { fontFamily: fonts.numeric, fontSize: type.body },
  status: { fontSize: type.small, fontWeight: '500' },
});
