// 使用者面（下半部）依狀態顯示的區塊。
// 這個畫面只回答一個問題：「店員剛剛問了什麼？我要點哪個？」所以問題卡最大、最先看到；
// 選中的答案是近黑底白字（呼應翻給店員看的告示牌），其餘一律墨黑與灰，顏色只留給確認／否定。
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Card, CardOption } from '../../core/types';
import { Button, Caption, Group, Icon, Row } from '../components';
import { useEnter, useReducedMotion } from '../motion';
import { fonts, radius, space, type, useColors } from '../theme';

function BackButton({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="返回上一步"
      hitSlop={8}
      style={({ pressed }) => [styles.back, pressed && { backgroundColor: c.raised }]}
    >
      <Icon name="chevron-back" size={20} color={c.ink} />
      <Text style={[styles.backText, { color: c.ink }]}>返回</Text>
    </Pressable>
  );
}

/** 卡片右上角：「判斷錯了？」 */
function WrongButton({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="判斷錯了，改成店員真正問的問題"
      hitSlop={8}
      style={({ pressed }) => [styles.wrong, pressed && { backgroundColor: c.raised }]}
    >
      <Text style={[styles.wrongText, { color: c.mute }]}>判斷錯了？</Text>
    </Pressable>
  );
}

function Badge({ tone, label }: { tone: 'positive' | 'negative'; label: string }) {
  const c = useColors();
  const fg = tone === 'positive' ? c.positive : c.negative;
  return (
    <View style={[styles.badge, { backgroundColor: tone === 'positive' ? c.positiveSoft : c.negativeSoft }]}>
      <Icon name={tone === 'positive' ? 'checkmark' : 'close'} size={14} color={fg} />
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** 現在這一張卡：白色面板、1px 邊，不浮起來。新卡進來時淡入（減少動態效果時不動）。 */
function LiveCard({
  children,
  enterKey,
  onBack,
  caption,
  badge,
}: {
  children: React.ReactNode;
  enterKey: string;
  onBack: () => void;
  caption: string;
  badge?: React.ReactNode;
}) {
  const c = useColors();
  const enter = useEnter(enterKey);
  return (
    <Animated.View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, enter]}>
      <View style={styles.cardHead}>
        <BackButton onPress={onBack} />
        <Text style={[styles.cardCaption, { color: c.mute }]} numberOfLines={1}>
          {caption}
        </Text>
        {badge ?? <View style={styles.badgeSlot} />}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </Animated.View>
  );
}

function CardFooter({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <View style={[styles.footer, { borderTopColor: c.rule }]}>{children}</View>;
}

function OptionTile({ label, selected, onPress, scale }: { label: string; selected: boolean; onPress: () => void; scale: number }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? c.primary : pressed ? c.raised : c.surface,
          borderColor: selected ? c.primary : c.control,
        },
      ]}
    >
      <Text
        style={[styles.optionText, { color: selected ? c.onPrimary : c.ink, fontSize: type.option * scale, lineHeight: 26 * scale }]}
        numberOfLines={2}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
      {selected && (
        <View style={styles.optionCheck}>
          <Icon name="checkmark" size={18} color={c.onPrimary} />
        </View>
      )}
    </Pressable>
  );
}

/** 3 個短選項（都在三個字以內）排三欄；其他排兩欄，單數時最後一個佔滿整行。 */
const columnsFor = (opts: CardOption[]) => (opts.length === 3 && opts.every((o) => [...o.label].length <= 3) ? 3 : 2);

export function CardPanel({
  card,
  options,
  chosen,
  scale,
  onPick,
  onSpeak,
  onDone,
  onBack,
  onWrong,
}: {
  card: Card;
  options: CardOption[];
  chosen?: CardOption;
  scale: number;
  onPick: (o: CardOption) => void;
  onSpeak: (o: CardOption) => void;
  onDone: () => void;
  onBack: () => void;
  /** 這張卡是語音判斷出來的時候才有：讓使用者改成店員真正問的問題 */
  onWrong?: () => void;
}) {
  const c = useColors();
  const answers = options.filter((o) => o.kind !== 'type');
  const typing = options.find((o) => o.kind === 'type');
  const cols = columnsFor(answers);

  return (
    <LiveCard
      enterKey={card.id}
      onBack={onBack}
      caption="店員在問"
      badge={chosen ? <Badge tone="positive" label="已回答" /> : onWrong ? <WrongButton onPress={onWrong} /> : undefined}
    >
      <Text style={[styles.question, { color: c.ink, fontSize: type.title * scale, lineHeight: 32 * scale }]} role="heading" aria-level={1}>
        {card.question}
      </Text>

      <View style={styles.grid}>
        {answers.map((o, i) => (
          <View
            key={o.label}
            style={{ width: cols === 2 && i === answers.length - 1 && answers.length % 2 === 1 ? '100%' : `${100 / cols}%`, padding: space.xs }}
          >
            <OptionTile label={o.label} selected={chosen?.label === o.label} onPress={() => onPick(o)} scale={scale} />
          </View>
        ))}
      </View>

      {chosen ? (
        <CardFooter>
          <Text style={[styles.footerText, { color: c.mute }]} numberOfLines={1}>
            店員那面顯示「<Text style={{ color: c.ink, fontWeight: '500' }}>{chosen.show}</Text>」
          </Text>
          <View style={styles.row}>
            <Button label="唸出來" icon="volume-high-outline" variant="secondary" onPress={() => onSpeak(chosen)} style={styles.flex} />
            <Button label="完成" variant="primary" onPress={onDone} style={styles.flex} />
          </View>
        </CardFooter>
      ) : (
        typing && (
          <Pressable
            onPress={() => onPick(typing)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.typeLink, { borderTopColor: c.rule }, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.typeLinkText, { color: c.ink }]}>
              <Text style={{ color: c.mute }}>沒有我要的？</Text>打字說明
            </Text>
            <Icon name="chevron-forward" size={18} color={c.mute} />
          </Pressable>
        )
      )}
    </LiveCard>
  );
}

function Notice({ tone, children }: { tone: 'positive' | 'negative'; children: React.ReactNode }) {
  const c = useColors();
  const fg = tone === 'positive' ? c.positive : c.negative;
  return (
    <View style={[styles.notice, { backgroundColor: tone === 'positive' ? c.positiveSoft : c.negativeSoft }]}>
      <Icon name={tone === 'positive' ? 'checkmark-circle' : 'refresh'} size={20} color={fg} />
      <Text style={[styles.noticeText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function AmountPanel({
  amount,
  perJin,
  candidates,
  confirmed,
  scale,
  onConfirm,
  onDone,
  onBack,
}: {
  amount: number;
  perJin: boolean;
  candidates?: number[];
  confirmed?: boolean;
  scale: number;
  onConfirm: (ok: boolean, value?: number) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const c = useColors();
  const choosing = !!candidates && confirmed === undefined;
  return (
    <LiveCard
      enterKey={`amount-${amount}-${candidates?.join(',') ?? ''}`}
      onBack={onBack}
      caption={choosing ? '店員說了兩個數字' : perJin ? '每斤的價錢' : '店員說的金額'}
      badge={confirmed === true ? <Badge tone="positive" label="已確認" /> : confirmed === false ? <Badge tone="negative" label="不對" /> : undefined}
    >
      {choosing ? (
        <>
          <Text style={[styles.question, { color: c.ink, fontSize: type.title * scale, lineHeight: 32 * scale }]}>是哪一個？</Text>
          <View style={styles.grid}>
            {candidates.map((v) => (
              <View key={v} style={{ width: '50%', padding: space.xs }}>
                <Pressable
                  onPress={() => onConfirm(true, v)}
                  accessibilityRole="button"
                  accessibilityLabel={`${v} 元`}
                  style={({ pressed }) => [styles.option, styles.candidate, { backgroundColor: pressed ? c.raised : c.surface, borderColor: c.control }]}
                >
                  <Text style={[styles.candidateText, { color: c.ink }]}>{v}</Text>
                  <Text style={[styles.unit, { color: c.mute }]}>元</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Button label="都不對，請再說一次" variant="danger" onPress={() => onConfirm(false)} />
        </>
      ) : (
        <>
          <View style={[styles.figureWell, { backgroundColor: c.raised }]}>
            <Text style={[styles.currency, { color: c.mute }]}>{perJin ? '每斤' : 'NT$'}</Text>
            <Text
              style={[styles.amount, { color: c.ink, fontSize: 44 * scale, lineHeight: 52 * scale }]}
              accessibilityLabel={`${amount} 元`}
            >
              {amount.toLocaleString('zh-TW')}
            </Text>
            <Text style={[styles.unit, { color: c.mute }]}>元</Text>
          </View>
          {confirmed === undefined ? (
            <View style={styles.row}>
              <Button label="對，確認" icon="checkmark" variant="primary" size="lg" onPress={() => onConfirm(true)} style={styles.flex} />
              <Button label="不對" variant="danger" size="lg" onPress={() => onConfirm(false)} style={styles.flex} />
            </View>
          ) : (
            <CardFooter>
              <Notice tone={confirmed ? 'positive' : 'negative'}>
                {confirmed ? '店員那面打了勾，可以付款了' : '已請店員再說一次金額'}
              </Notice>
              <Button label="完成" variant="primary" onPress={onDone} />
            </CardFooter>
          )}
        </>
      )}
    </LiveCard>
  );
}

export function DosagePanel({
  text,
  saved,
  scale,
  onSave,
  onAgain,
  onDone,
  onBack,
}: {
  text: string;
  saved: boolean;
  scale: number;
  onSave: () => void;
  onAgain: () => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const c = useColors();
  return (
    <LiveCard enterKey={`dosage-${text}`} onBack={onBack} caption="用法用量" badge={saved ? <Badge tone="positive" label="已存" /> : undefined}>
      <View style={[styles.figureWell, styles.dosageWell, { backgroundColor: c.raised }]}>
        <Text style={[styles.dosage, { color: c.ink, fontSize: type.title * scale, lineHeight: 34 * scale }]}>{text}</Text>
      </View>
      {saved ? (
        <CardFooter>
          <Text style={[styles.footerText, { color: c.mute }]}>回家可以在「紀錄」裡再看一次。</Text>
          <Button label="完成" variant="primary" onPress={onDone} />
        </CardFooter>
      ) : (
        <View style={styles.row}>
          <Button label="存下來" icon="bookmark-outline" variant="primary" size="lg" onPress={onSave} style={styles.flex} />
          <Button label="再說一次" variant="secondary" size="lg" onPress={onAgain} style={styles.flex} />
        </View>
      )}
    </LiveCard>
  );
}

export function UnknownPanel({
  text,
  onAgain,
  onType,
  onBack,
  onClerkPick,
  onKnow,
  scale,
}: {
  text: string;
  onAgain: () => void;
  onType: () => void;
  onBack: () => void;
  onClerkPick: () => void;
  /** 使用者自己知道店員在問什麼：選對的問題，順便記成辨識錯誤 */
  onKnow: () => void;
  scale: number;
}) {
  const c = useColors();
  return (
    <LiveCard enterKey={`unknown-${text}`} onBack={onBack} caption="沒有把握是什麼問題">
      <Text style={[styles.unknown, { color: c.ink, fontSize: type.option * scale, lineHeight: 28 * scale }]}>「{text}」</Text>
      <Text style={[styles.footerText, { color: c.mute }]}>只有你看得到這句。店員那面不會顯示，免得聽錯造成誤會。</Text>
      <View style={styles.row}>
        <Button label="請店員再說明" variant="primary" size="lg" fontSize={17} onPress={onAgain} style={styles.flex} />
        <Button label="我打字" icon="create-outline" variant="secondary" size="lg" fontSize={17} onPress={onType} style={styles.flex} />
      </View>
      <View style={styles.row}>
        <Button label="我知道他在問什麼" variant="ghost" onPress={onKnow} style={styles.flex} />
        <Button label="請店員用點的" icon="hand-left-outline" variant="ghost" onPress={onClerkPick} style={styles.flex} />
      </View>
    </LiveCard>
  );
}

/** 收音中：一個緩慢呼吸的綠點。手動模式時是靜止的灰點。 */
function ListeningDot({ listening }: { listening: boolean }) {
  const c = useColors();
  const reduce = useReducedMotion();
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduce || !listening) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, listening, v]);
  return <Animated.View style={[styles.liveDot, { backgroundColor: listening ? c.positive : c.control, opacity: listening ? v : 1 }]} />;
}

/** 選項預覽：「要 / 不用」，超過三個就寫「等 5 種」 */
const preview = (card: Card) => {
  const labels = card.options.map((o) => o.label);
  return labels.length > 3 ? `${labels.slice(0, 3).join(' / ')} 等 ${labels.length} 種` : labels.join(' / ');
};

/** 「我的常點」：自己存的句子，點一下就顯示給店員 */
function FavoritesSection({
  favorites,
  shown,
  example,
  suggested,
  onShow,
  onEdit,
}: {
  favorites: string[];
  /** 還是預設的建議句，使用者沒改過 */
  suggested: boolean;
  shown?: string;
  example: string;
  onShow: (text: string) => void;
  onEdit: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Caption>{suggested ? '我的常點（建議）' : '我的常點'}</Caption>
        {favorites.length > 0 && (
          <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="編輯我的常點" hitSlop={8}>
            <Text style={[styles.sectionAction, { color: c.mute }]}>{suggested ? '改成我的' : '編輯'}</Text>
          </Pressable>
        )}
      </View>
      <Group>
        {favorites.length ? (
          favorites.map((text, i) => (
            <Row
              key={text}
              first={i === 0}
              icon="star-outline"
              title={text}
              subtitle={shown === text ? '店員那面正在顯示' : undefined}
              selected={shown === text}
              trailing={shown === text ? 'check' : 'chevron'}
              accessibilityLabel={`給店員看：${text}`}
              onPress={() => onShow(text)}
            />
          ))
        ) : (
          <Row first icon="add-circle-outline" title="新增常點的東西" subtitle={`例如：${example}`} trailing="chevron" onPress={onEdit} />
        )}
      </Group>
    </View>
  );
}

export function IdlePanel({
  storeName,
  storeCards,
  genericCards,
  listening,
  firstRun,
  onDismissFirstRun,
  onPick,
  onAmount,
  hand,
  intro,
  onShowIntro,
  onClerkPick,
  noSpeech,
  favorites,
  shownFavorite,
  favoriteExample,
  favoritesSuggested,
  onFavorite,
  onEditFavorites,
}: {
  favorites: string[];
  favoritesSuggested: boolean;
  /** 店員那面現在顯示的是哪一句常點 */
  shownFavorite?: string;
  favoriteExample: string;
  onFavorite: (text: string) => void;
  onEditFavorites: () => void;
  onClerkPick: () => void;
  /** 這支手機不能語音辨識：把「請店員點選」放到最前面 */
  noSpeech: boolean;
  hand: boolean;
  intro: string;
  onShowIntro: () => void;
  storeName: string;
  storeCards: Card[];
  genericCards: Card[];
  listening: boolean;
  firstRun: boolean;
  onDismissFirstRun: () => void;
  onPick: (card: Card) => void;
  onAmount: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.idle}>
      {firstRun && (
        <View style={[styles.tip, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.tipTitle, { color: c.ink }]}>{hand ? '拿著手機就好' : '把手機平放在櫃檯上'}</Text>
          <Text style={[styles.footerText, { color: c.mute }]}>
            {hand
              ? '選好答案後，畫面會變成大字卡，把手機轉過去給店員看。有櫃檯可以放時，可以在「⋯」改成平放的雙面畫面。'
              : '黑色那一半朝向店員，這一半朝向你。麥克風那一頭朝店員，辨識會比較準。'}
          </Text>
          <Button label="知道了，開始" variant="primary" onPress={onDismissFirstRun} />
        </View>
      )}

      {noSpeech ? (
        <View style={[styles.tip, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.tipTitle, { color: c.ink }]}>這支手機不能語音辨識</Text>
          <Text style={[styles.footerText, { color: c.mute }]}>
            {hand ? '把手機轉給店員，請他直接點要問的問題。' : '店員可以在他那一半直接點要問的問題。'}
          </Text>
          <Button label="請店員點選問題" icon="hand-left-outline" variant="primary" onPress={onClerkPick} />
          {hand && <Button label="先給店員看第一句話" icon="eye-outline" variant="secondary" onPress={onShowIntro} accessibilityLabel={`先給店員看：${intro}`} />}
        </View>
      ) : (
        hand && (
          <View style={styles.row}>
            <Button label="給店員看" icon="eye-outline" variant="secondary" onPress={onShowIntro} accessibilityLabel={`先給店員看：${intro}`} style={styles.flex} />
            <Button label="請店員點選" icon="hand-left-outline" variant="secondary" onPress={onClerkPick} style={styles.flex} />
          </View>
        )
      )}

      <View style={styles.wait}>
        <ListeningDot listening={listening} />
        <View style={styles.flex}>
          <Text style={[styles.waitTitle, { color: c.ink }]} role="heading" aria-level={1}>{listening ? '正在聽店員說話' : '店員問了什麼？'}</Text>
          <Text style={[styles.waitSub, { color: c.mute }]}>
            {listening ? '他問完，選項會自動出現。也可以直接點下面的問題。' : '點下面對應的問題，選項就會出現。'}
          </Text>
        </View>
      </View>

      <FavoritesSection
        favorites={favorites}
        shown={shownFavorite}
        example={favoriteExample}
        suggested={favoritesSuggested}
        onShow={onFavorite}
        onEdit={onEditFavorites}
      />

      {storeCards.length > 0 && (
        <View style={styles.section}>
          <Caption>{storeName}常問</Caption>
          <Group>
            {storeCards.map((card, i) => (
              <Row key={card.id} first={i === 0} title={card.question} subtitle={preview(card)} trailing="chevron" onPress={() => onPick(card)} />
            ))}
          </Group>
        </View>
      )}

      <View style={styles.section}>
        <Caption>結帳常問</Caption>
        <Group>
          <Row first title="金額確認" subtitle="輸入店員說的數字，放大給他確認" icon="cash-outline" trailing="chevron" onPress={onAmount} />
          {genericCards.map((card) => (
            <Row key={card.id} title={card.question} subtitle={preview(card)} trailing="chevron" onPress={() => onPick(card)} />
          ))}
        </Group>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingTop: space.sm, minHeight: 52 },
  cardCaption: { flex: 1, fontSize: type.small, fontWeight: '500', textAlign: 'center' },
  cardBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, minWidth: 72, paddingRight: space.sm, borderRadius: radius.control },
  backText: { fontSize: type.body, fontWeight: '500' },
  badgeSlot: { minWidth: 72 },
  wrong: { minWidth: 72, minHeight: 36, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: space.xs, borderRadius: radius.control },
  wrongText: { fontSize: type.small, textDecorationLine: 'underline' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 72,
    justifyContent: 'center',
    borderRadius: radius.control,
    paddingHorizontal: space.sm,
    height: 26,
  },
  badgeText: { fontSize: type.small, fontWeight: '500' },
  question: { fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -space.xs },
  option: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  optionText: { fontWeight: '500', textAlign: 'center' },
  optionCheck: { position: 'absolute', top: 6, right: 6 },
  footer: { borderTopWidth: 1, marginTop: space.xs, paddingTop: space.md, gap: space.md },
  footerText: { fontSize: type.label, lineHeight: 21 },
  typeLink: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, marginTop: space.xs, paddingTop: space.md, minHeight: 48 },
  typeLinkText: { flex: 1, fontSize: type.body, fontWeight: '500' },
  figureWell: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.control,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
  },
  dosageWell: { justifyContent: 'flex-start' },
  currency: { fontSize: type.body, fontWeight: '500' },
  amount: { fontFamily: fonts.numeric },
  unit: { fontSize: type.option, fontWeight: '500' },
  candidate: { minHeight: 88, flexDirection: 'row', alignItems: 'baseline', gap: 4, paddingTop: space.lg },
  candidateText: { fontFamily: fonts.numeric, fontSize: 36 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.control, padding: space.md },
  noticeText: { flex: 1, fontSize: type.label, fontWeight: '500' },
  dosage: { fontWeight: '500' },
  unknown: { fontWeight: '500' },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  idle: { gap: space.xl },
  tip: { borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: space.md },
  tipTitle: { fontSize: 18, fontWeight: '500' },
  wait: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  waitTitle: { fontSize: 18, fontWeight: '500' },
  waitSub: { fontSize: type.label, lineHeight: 20, marginTop: 2 },
  liveDot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 4 },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionAction: { fontSize: type.small, textDecorationLine: 'underline' },
});
