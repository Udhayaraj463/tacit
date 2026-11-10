// 櫃檯模式：上半部朝店員（旋轉 180°），下半部朝自己。
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BUILTIN_CARDS,
  STORES,
  cardsForStore,
  optionsFor,
} from "../core/cards";
import { classify, type ClassifyResult } from "../core/classify";
import {
  MAX_FAVORITES,
  MAX_FAVORITE_LEN,
  addFavorite,
  favoritesFor,
  removeFavorite,
  usingSuggested,
} from "../core/favorites";
import { fuse } from "../core/understand";
import {
  clerkView,
  counterReducer,
  initialCounter,
  type AgainHow,
  clerkSpeech,
  type Clerk,
  type CounterAction,
  type CounterState,
} from "../core/counter-machine";
import type { Card, CardOption } from "../core/types";
import demo from "../data/demo.json";
import { FAVORITE_EXAMPLE, SUGGESTED_FAVORITES } from "../i18n/zh-TW";
import {
  CLOUD_LISTEN_AVAILABLE,
  useCloudListener,
  type CloudListenState,
} from "../asr/useCloudListener";
import {
  NEEDS_TAP_TO_LISTEN,
  micErrorText,
  useRecognizer,
  webSpeechInfo,
  type MicState,
} from "../asr/useRecognizer";
import { understand } from "../llm/understand-client";
import { buzzCall, speak, tap } from "../platform/feedback";
import { useKeepScreenOn } from "../platform/keep-awake";
import { saveSession } from "../state/records-store";
import type { NewEvent, Session } from "../state/session-log";
import { useSettings } from "../state/settings";
import { Button, Chip, Group, Hint, Icon, Row, Sheet } from "../ui/components";
import { CallAlert } from "../ui/counter/CallAlert";
import { ClerkPanel } from "../ui/counter/ClerkPanel";
import { ClerkPick } from "../ui/counter/ClerkPick";
import { ShowToClerk } from "../ui/counter/ShowToClerk";
import {
  AmountPanel,
  CardPanel,
  DosagePanel,
  IdlePanel,
  UnknownPanel,
} from "../ui/counter/StagePanels";
import { StoreGrid } from "../ui/StoreCard";
import { storeIcon } from "../ui/store-icons";
import { fontScales, radius, sign, space, useColors } from "../ui/theme";

type SheetName =
  | "type"
  | "more"
  | "demo"
  | "store"
  | "amount"
  | "mic"
  | "wrong"
  | "usual"
  | "again";

const MIC_LABEL: Record<MicState, string> = {
  idle: NEEDS_TAP_TO_LISTEN ? "點我開始聽" : "手動",
  starting: "啟動中",
  listening: "正在聽",
  error: "麥克風不可用",
  unsupported: "手動",
};

const CLOUD_LABEL: Record<CloudListenState, string> = {
  idle: "點我開始聽",
  listening: "正在聽（雲端）",
  hearing: "店員在說話",
  error: "麥克風不可用",
};

/** 開了「自動唸」時會唸的：使用者這邊要說的話 */
const AUTO_SPEAK = new Set<Clerk["type"]>([
  "answer",
  "again",
  "amountOk",
  "amountNo",
  "typed",
]);

const TYPE_PRESETS = [
  "我是聽障者，請用手指給我看",
  "請寫給我",
  "有書面說明嗎？",
  "我要這個",
  "謝謝",
  "再等我一下",
];

/** 「我沒聽懂」面板：請店員怎麼做，按了就顯示在店員那面 */
const AGAIN_CHOICES: {
  how: AgainHow;
  label: string;
  icon:
    | "arrow-undo-outline"
    | "hand-right-outline"
    | "chatbubbles-outline"
    | "create-outline";
}[] = [
  { how: "repeat", label: "請再說一次，慢一點", icon: "arrow-undo-outline" },
  { how: "point", label: "請指給我看", icon: "hand-right-outline" },
  { how: "rephrase", label: "請換個說法", icon: "chatbubbles-outline" },
  { how: "write", label: "請寫給我", icon: "create-outline" },
];

/** 一次櫃檯模式 = 一筆紀錄；第一個事件發生時才建立，離開畫面時存起來。 */
function useSessionLog(initialStore: string) {
  const session = useRef<Session | null>(null);
  const startedAt = useRef(0);
  const store = useRef(initialStore);
  useEffect(
    () => () => {
      if (session.current) void saveSession(session.current);
    },
    [],
  );
  const log = useCallback((e: NewEvent) => {
    if (!session.current) {
      session.current = {
        id: new Date().toISOString(),
        store: store.current,
        events: [],
      };
      startedAt.current = Date.now();
    }
    const t = Math.round((Date.now() - startedAt.current) / 100) / 10;
    session.current.events.push({ ...e, t } as Session["events"][number]);
  }, []);
  const setStore = useCallback((s: string) => {
    store.current = s;
    if (session.current) session.current.store = s;
  }, []);
  return { log, setStore };
}

export default function CounterScreen() {
  useKeepScreenOn();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const [state, dispatch] = useReducer(counterReducer, initialCounter);
  const [store, setStore] = useState(settings.lastStore);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [draft, setDraft] = useState("");
  const [clerkPick, setClerkPick] = useState(false);
  /** 上一次語音判斷：手機聽到什麼、判斷成什麼。給「判斷錯了？」用 */
  const [guess, setGuess] = useState<{ heard: string; got: string } | null>(
    null,
  );
  /** 「拿著」模式：全螢幕大字卡，轉過去給店員看 */
  const [showing, setShowing] = useState(false);
  /** 正在問雲端的那一句（null = 沒在問）。文字是店員說的話；錄音還沒轉好時是空字串 */
  const [thinking, setThinking] = useState<string | null>(null);
  /** 每問一次 +1；使用者先動了（選卡、返回…）也 +1，晚回來的答案就不會蓋掉畫面 */
  const asking = useRef(0);
  const cancelAsk = () => {
    asking.current++;
    setThinking(null);
  };
  const hand = settings.holdMode === "hand";
  /** 拿著時，該讓店員看的時候自動跳出大字卡（等面板收起再跳，免得兩個彈窗疊在一起） */
  const showToClerk = (delay = 0) => {
    if (!hand) return;
    if (delay) setTimeout(() => setShowing(true), delay);
    else setShowing(true);
  };
  const { log, setStore: setLogStore } = useSessionLog(store);

  const cards = useMemo(() => cardsForStore(BUILTIN_CARDS, store), [store]);
  const suggested = SUGGESTED_FAVORITES[store] ?? [];
  const favorites = favoritesFor(settings.favorites, store, suggested);
  const favoriteExample = FAVORITE_EXAMPLE[store] ?? FAVORITE_EXAMPLE.other;
  const userScale = fontScales[settings.fontScaleUser];
  const clerkScale = fontScales[settings.fontScaleClerk];
  const haptics = settings.haptics;

  const view = clerkView(state, settings.introText);
  const clerk =
    state.clerk.type === "intro" && settings.introName
      ? { ...view, label: `您好，我是${settings.introName}` }
      : view;
  const callWho = settings.callNumber || settings.callName;
  /** 店員面這一句的唸法；自我介紹有名字時先說名字 */
  const speechFor = (st: CounterState) => {
    const text = clerkSpeech(st, settings.introText);
    return st.clerk.type === "intro" && settings.introName
      ? `您好，我是${settings.introName}。${text}`
      : text;
  };

  const closeSheet = () => {
    setSheet(null);
    setDraft("");
  };

  const applyResult = (text: string, result: ClassifyResult) => {
    if (result.kind === "call") {
      log({ type: "call" });
      buzzCall(haptics);
    } else if (result.kind === "card")
      log({
        type: "card",
        id: result.card.id,
        question: result.card.question,
        by: result.byModel ? "model" : "rule",
      });
    else if (result.kind === "amount")
      log({ type: "amount", value: result.amount, perJin: result.perJin });
    else if (result.kind === "dosage")
      log({ type: "dosage", text: result.text });
    else log({ type: "unknown", text: result.text });
    if (text && (result.kind === "card" || result.kind === "unknown")) {
      setGuess({
        heard: text,
        got: result.kind === "card" ? result.card.id : "unknown",
      });
    } else if (result.kind !== "call") setGuess(null);
    dispatch({ type: "heard", text, result });
  };

  /** 「判斷錯了」選了正確的問題（或都不是）：記下來，順便跳到那張卡 */
  const correctGuess = (actual: Card | null) => {
    if (guess)
      log({
        type: "misheard",
        heard: guess.heard,
        got: guess.got,
        actual: actual?.id ?? null,
      });
    setGuess(null);
    closeSheet();
    if (actual) {
      tap(haptics);
      log({
        type: "card",
        id: actual.id,
        question: actual.question,
        by: "manual",
      });
      dispatch({ type: "pickCard", card: actual });
    }
  };

  const classifyHere = (text: string, confidence?: number) =>
    classify(text, {
      store,
      cards: BUILTIN_CARDS,
      call: { number: settings.callNumber, name: settings.callName },
      confidence,
    });

  /** 店員說的話：來自語音辨識，或「模擬店員說話」 */
  const handleUtterance = (text: string, confidence?: number) => {
    log({
      type: "heard",
      text,
      ...(confidence !== undefined && { conf: confidence }),
    });
    const result = classifyHere(text, confidence);
    if (!(settings.cloudHelp && result.kind === "unknown" && result.askLLM)) {
      applyResult(text, result);
      return;
    }
    // 規則聽不懂：問雲端（最多等 2.5 秒），問不到就照樣顯示「不確定」
    const id = ++asking.current;
    setThinking(text);
    void understand({ store, text }).then((ans) => {
      if (id !== asking.current) return;
      setThinking(null);
      applyResult(text, fuse(result, ans?.cardId ?? null, cards));
    });
  };

  /** 雲端收音錄到的一句：轉文字 + 判斷一起做，再用規則檢查（叫號、金額、用藥照規則） */
  const handleAudio = (wav: string) => {
    const id = ++asking.current;
    setThinking("");
    void understand({ store, audio: { mime: "audio/wav", data: wav } }).then(
      (ans) => {
        if (id !== asking.current) return;
        setThinking(null);
        if (!ans?.transcript) return;
        log({ type: "heard", text: ans.transcript });
        applyResult(
          ans.transcript,
          fuse(classifyHere(ans.transcript), ans.cardId, cards),
        );
      },
    );
  };

  const mic = useRecognizer(handleUtterance);
  const { start: startMic, setHints } = mic;
  // 這間店所有卡片的關鍵字（兩個字以上）交給辨識引擎當提示
  useEffect(() => {
    setHints(
      [
        ...new Set(
          cards.flatMap((x) => x.keywords).filter((k) => k.length >= 2),
        ),
      ].slice(0, 100),
    );
  }, [cards, setHints]);
  useEffect(() => {
    // 網頁要等使用者點一下（「知道了」或麥克風）才能開始
    if (settings.autoListen && !NEEDS_TAP_TO_LISTEN) void startMic();
  }, [settings.autoListen, startMic]);

  // 記住這支手機能不能語音辨識
  const micBroken =
    mic.state === "unsupported" ||
    (mic.state === "error" && mic.error !== "needs-tap");
  useEffect(() => {
    if (micBroken && !settings.speechBroken) update({ speechBroken: true });
    if (mic.state === "listening" && settings.speechBroken)
      update({ speechBroken: false });
  }, [micBroken, mic.state, settings.speechBroken, update]);

  // 內建辨識不能用（例如 iPhone Safari）＋ 打開了雲端判斷：改用雲端收音
  const cloud = useCloudListener(handleAudio);
  const cloudMode =
    settings.cloudHelp &&
    CLOUD_LISTEN_AVAILABLE &&
    (micBroken || settings.speechBroken) &&
    mic.state !== "listening";
  const { stop: stopCloud } = cloud;
  useEffect(() => {
    if (!cloudMode) stopCloud();
  }, [cloudMode, stopCloud]);

  const toggleMic = () => {
    if (cloudMode) {
      if (cloud.state === "idle" || cloud.state === "error") void cloud.start();
      else cloud.stop();
      return;
    }
    if (mic.state === "listening" || mic.state === "starting") mic.stop();
    else if (mic.state === "error" && mic.error === "needs-tap")
      void mic.start();
    else if (mic.state === "unsupported" || mic.state === "error")
      setSheet("mic");
    else void mic.start();
  };

  const back = () => {
    cancelAsk();
    tap(haptics);
    dispatch({ type: "back" });
  };

  // Android 實體返回鍵：卡片打開時先退回上一步，回到列表才離開櫃檯模式
  const canGoBack = state.screen.type !== "idle";
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      dispatch({ type: "back" });
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  /** 唸出來時暫停收音，唸完 0.3 秒後恢復 */
  const speakOut = (text: string) => {
    mic.setMuted(true);
    cloud.setMuted(true);
    speak(text, () =>
      setTimeout(() => {
        mic.setMuted(false);
        cloud.setMuted(false);
      }, 300),
    );
  };

  /** 店員面上現在那一句，唸出來（給不識字的使用者、或看不清楚字的店員） */
  const speakClerk = () => {
    tap(haptics);
    speakOut(speechFor(state));
  };

  /**
   * 會換掉店員面的動作走這裡：開了「自動唸」就把新的那一句唸出來。
   * 店員自己說的話（問題、金額）只顯示，不唸回去給他聽。
   */
  const act = (action: CounterAction) => {
    const next = counterReducer(state, action);
    dispatch(action);
    if (
      settings.ttsAuto &&
      next.clerk !== state.clerk &&
      AUTO_SPEAK.has(next.clerk.type)
    )
      speakOut(speechFor(next));
  };

  /** 店員在翻過去的畫面上自己點的問題 */
  const clerkPicked = (card: Card) => {
    setClerkPick(false);
    cancelAsk();
    tap(haptics);
    log({ type: "card", id: card.id, question: card.question, by: "clerk" });
    dispatch({ type: "pickCard", card });
  };

  const openClerkPick = () => {
    closeSheet();
    setClerkPick(true);
  };

  const pickCard = (card: Card) => {
    cancelAsk();
    setGuess(null);
    tap(haptics);
    log({ type: "card", id: card.id, question: card.question, by: "manual" });
    dispatch({ type: "pickCard", card });
  };

  const answer = (option: CardOption) => {
    if (option.kind === "type") {
      setSheet("type");
      return;
    }
    tap(haptics);
    const next = option.followup
      ? BUILTIN_CARDS.find((x) => x.id === option.followup)
      : undefined;
    log({ type: "answer", text: option.show });
    if (next)
      log({ type: "card", id: next.id, question: next.question, by: "manual" });
    act({ type: "answer", option, next });
    showToClerk();
  };

  const again = (how: AgainHow = "repeat") => {
    closeSheet();
    cancelAsk();
    tap(haptics);
    log({ type: "again", how });
    act({ type: "again", how });
    // 從面板按的：等面板收起再跳大字卡
    showToClerk(sheet === "again" ? 350 : 0);
  };

  const confirmAmount = (ok: boolean, value?: number) => {
    if (state.screen.type !== "amount") return;
    tap(haptics);
    log({ type: "amountConfirm", ok, value: value ?? state.screen.amount });
    act({ type: "amountConfirm", ok, value });
    showToClerk();
  };

  const sendTyped = () => {
    const text = draft.trim();
    if (text) {
      log({ type: "typed", text });
      act({ type: "typed", text });
      showToClerk(350);
    }
    closeSheet();
  };

  /** 我的常點：點一下就顯示給店員（跟打字一樣），拿著模式會跳出大字卡 */
  const showFavorite = (text: string) => {
    cancelAsk();
    tap(haptics);
    log({ type: "typed", text });
    act({ type: "typed", text });
    showToClerk();
  };

  const saveFavorite = (text: string) =>
    update({
      favorites: addFavorite(settings.favorites, store, text, suggested),
    });
  const deleteFavorite = (text: string) =>
    update({
      favorites: removeFavorite(settings.favorites, store, text, suggested),
    });
  const draftSaved = favorites.includes(draft.trim().replace(/\s+/g, " "));

  const sendManualAmount = () => {
    const value = parseInt(draft.replace(/\D/g, ""), 10);
    if (!Number.isNaN(value))
      applyResult("", { kind: "amount", amount: value, perJin: false });
    closeSheet();
  };

  const changeStore = (id: string) => {
    setStore(id);
    setLogStore(id);
    update({ lastStore: id });
    closeSheet();
  };

  const end = () => {
    closeSheet();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const s = state.screen;
  const storeName = STORES.find((x) => x.id === store)?.name ?? "";

  return (
    <View style={[styles.root, { backgroundColor: c.ground }]}>
      <StatusBar style={hand ? "auto" : "light"} />
      {!hand && (
        <View style={[styles.clerkArea, { paddingTop: insets.top }]}>
          <ClerkPanel
            view={clerk}
            scale={clerkScale}
            onClerkPick={openClerkPick}
            onSpeak={speakClerk}
          />
        </View>
      )}

      <View
        style={[
          styles.user,
          {
            paddingLeft: Math.max(insets.left, space.lg),
            paddingRight: Math.max(insets.right, space.lg),
          },
          hand && { paddingTop: insets.top },
        ]}
      >
        <View style={styles.statusbar}>
          <Chip
            label={storeName}
            icon={storeIcon(store)}
            trailingIcon="chevron-down"
            onPress={() => setSheet("store")}
          />
          {cloudMode ? (
            <Chip
              label={CLOUD_LABEL[cloud.state]}
              dot={
                cloud.state === "listening"
                  ? "on"
                  : cloud.state === "hearing"
                    ? "busy"
                    : "off"
              }
              onPress={toggleMic}
            />
          ) : (
            <Chip
              label={
                mic.state === "error" && mic.error === "needs-tap"
                  ? "點我繼續聽"
                  : MIC_LABEL[mic.state]
              }
              dot={
                mic.state === "listening"
                  ? "on"
                  : mic.state === "starting"
                    ? "busy"
                    : "off"
              }
              onPress={toggleMic}
            />
          )}
          <Chip
            label=""
            icon="volume-high-outline"
            accessibilityLabel="把店員面那一句唸出來"
            onPress={speakClerk}
          />
          {hand && (
            <Chip
              label=""
              icon="eye-outline"
              accessibilityLabel="給店員看"
              onPress={() => setShowing(true)}
            />
          )}
          {!!callWho && (
            <Chip
              label={`等 ${callWho}${settings.callNumber ? " 號" : ""}`}
              icon="notifications-outline"
            />
          )}
        </View>

        <ScrollView
          style={styles.stage}
          contentContainerStyle={styles.stageContent}
          keyboardShouldPersistTaps="handled"
        >
          {thinking !== null && (
            <View style={[styles.heard, { borderLeftColor: c.positive }]}>
              <Icon name="cloud-outline" size={22} color={c.mute} />
              <Text
                style={[
                  styles.heardText,
                  {
                    color: c.mute,
                    fontSize: 21 * userScale,
                    lineHeight: 29 * userScale,
                  },
                ]}
                numberOfLines={3}
              >
                {thinking ? (
                  <>
                    聽到 <Text style={{ color: c.ink }}>{thinking}</Text>
                    ，正在判斷…
                  </>
                ) : (
                  "正在把店員的話轉成文字…"
                )}
              </Text>
            </View>
          )}
          {!!mic.partial && (
            <View style={[styles.heard, { borderLeftColor: c.positive }]}>
              <Icon name="ear-outline" size={22} color={c.mute} />
              <Text
                style={[
                  styles.heardText,
                  {
                    color: c.mute,
                    fontSize: 21 * userScale,
                    lineHeight: 29 * userScale,
                  },
                ]}
                numberOfLines={3}
              >
                聽到 <Text style={{ color: c.ink }}>{mic.partial}</Text>…
              </Text>
            </View>
          )}
          {!mic.partial &&
            !!state.heard &&
            s.type !== "idle" &&
            s.type !== "unknown" && (
              <View style={[styles.heard, { borderLeftColor: c.border }]}>
                <Icon name="ear-outline" size={22} color={c.mute} />
                <Text
                  style={[
                    styles.heardText,
                    {
                      color: c.mute,
                      fontSize: 21 * userScale,
                      lineHeight: 29 * userScale,
                    },
                  ]}
                  numberOfLines={3}
                >
                  店員說{" "}
                  <Text style={{ color: c.ink, fontWeight: "500" }}>
                    {state.heard}
                  </Text>
                </Text>
              </View>
            )}
          {s.type === "idle" && (
            <IdlePanel
              storeName={storeName}
              storeCards={cards.filter((x) => !x.stores.includes("*"))}
              genericCards={cards.filter((x) => x.stores.includes("*"))}
              listening={
                mic.state === "listening" ||
                (cloudMode && cloud.state !== "idle" && cloud.state !== "error")
              }
              firstRun={!settings.seenPlacementTip}
              hand={hand}
              intro={settings.introText}
              onShowIntro={() => setShowing(true)}
              onClerkPick={openClerkPick}
              noSpeech={
                !cloudMode &&
                (micBroken ||
                  (settings.speechBroken && mic.state !== "listening"))
              }
              onDismissFirstRun={() => {
                update({ seenPlacementTip: true });
                // 網頁要在這一下點擊裡開始收音
                if (settings.autoListen && cloudMode) void cloud.start();
                else if (settings.autoListen && NEEDS_TAP_TO_LISTEN)
                  void mic.start();
              }}
              onPick={pickCard}
              onAmount={() => setSheet("amount")}
              favorites={favorites}
              shownFavorite={
                state.clerk.type === "typed" ? state.clerk.text : undefined
              }
              favoriteExample={favoriteExample}
              favoritesSuggested={usingSuggested(settings.favorites, store)}
              onFavorite={showFavorite}
              onEditFavorites={() => setSheet("usual")}
            />
          )}
          {s.type === "card" && (
            <CardPanel
              onBack={back}
              onWrong={
                guess && guess.got === s.card.id
                  ? () => setSheet("wrong")
                  : undefined
              }
              card={s.card}
              options={optionsFor(s.card)}
              chosen={s.chosen}
              scale={userScale}
              onPick={answer}
              onSpeak={(o) => speakOut(o.tts)}
              onDone={() => dispatch({ type: "done" })}
            />
          )}
          {s.type === "amount" && (
            <AmountPanel
              {...s}
              onBack={back}
              scale={userScale}
              onConfirm={confirmAmount}
              onDone={() => dispatch({ type: "done" })}
            />
          )}
          {s.type === "dosage" && (
            <DosagePanel
              onBack={back}
              text={s.text}
              saved={s.saved}
              scale={userScale}
              onSave={() => {
                log({ type: "dosageSaved" });
                act({ type: "dosageSaved" });
              }}
              onAgain={() => again()}
              onDone={() => dispatch({ type: "done" })}
            />
          )}
          {s.type === "unknown" && (
            <UnknownPanel
              onBack={back}
              onClerkPick={openClerkPick}
              onKnow={() => setSheet("wrong")}
              text={s.text}
              scale={userScale}
              onAgain={() => setSheet("again")}
              onType={() => setSheet("type")}
            />
          )}
        </ScrollView>

        <View
          style={[
            styles.actions,
            {
              backgroundColor: c.surface,
              borderTopColor: c.border,
              paddingBottom: Math.max(insets.bottom, space.sm) + space.xs,
              marginLeft: -Math.max(insets.left, space.lg),
              marginRight: -Math.max(insets.right, space.lg),
              paddingLeft: Math.max(insets.left, space.lg),
              paddingRight: Math.max(insets.right, space.lg),
            },
          ]}
        >
          <Button
            label="我沒聽懂"
            icon="help-circle-outline"
            variant="primary"
            size="lg"
            fontSize={17}
            onPress={() => setSheet("again")}
            style={styles.againButton}
          />
          <Button
            label="打字"
            icon="create-outline"
            variant="secondary"
            size="lg"
            fontSize={17}
            onPress={() => setSheet("type")}
            style={styles.sideButton}
          />
          <Button
            label=""
            icon="ellipsis-horizontal"
            variant="ghost"
            size="lg"
            accessibilityLabel="更多"
            onPress={() => setSheet("more")}
            style={styles.moreButton}
          />
        </View>
      </View>

      <Sheet
        visible={sheet === "type"}
        onClose={closeSheet}
        title="打字給店員看"
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="店員會在上半部看到你打的字"
          placeholderTextColor={c.mute}
          multiline
          autoFocus
          style={[
            styles.input,
            styles.textarea,
            { color: c.ink, borderColor: c.border, backgroundColor: c.ground },
          ]}
          accessibilityLabel="要給店員看的文字"
        />
        <View style={styles.chips}>
          {TYPE_PRESETS.map((t) => (
            <Chip key={t} label={t} onPress={() => setDraft(t)} />
          ))}
        </View>
        <Button
          label="顯示給店員"
          variant="primary"
          size="lg"
          onPress={sendTyped}
          disabled={!draft.trim()}
        />
        <Button
          label={draftSaved ? "已存在我的常點" : `存成${storeName}的常點`}
          icon="star-outline"
          variant="ghost"
          onPress={() => saveFavorite(draft)}
          disabled={
            !draft.trim() ||
            draftSaved ||
            [...draft.trim()].length > MAX_FAVORITE_LEN
          }
        />
      </Sheet>

      <Sheet
        visible={sheet === "usual"}
        onClose={closeSheet}
        title={`我的常點・${storeName}`}
      >
        <Hint>{`存好的句子會出現在等待畫面上，到櫃檯點一下就顯示給店員看。每種櫃檯最多 ${MAX_FAVORITES} 句，只存在這支手機。`}</Hint>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`例如：${favoriteExample}`}
          placeholderTextColor={c.mute}
          maxLength={MAX_FAVORITE_LEN}
          style={[
            styles.input,
            { color: c.ink, borderColor: c.border, backgroundColor: c.ground },
          ]}
          accessibilityLabel="要存的句子"
          onSubmitEditing={() => {
            saveFavorite(draft);
            setDraft("");
          }}
        />
        <Button
          label="加入"
          icon="add"
          variant="primary"
          disabled={!draft.trim()}
          onPress={() => {
            saveFavorite(draft);
            setDraft("");
          }}
        />
        {favorites.length > 0 && (
          <View
            style={[
              styles.favList,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            {favorites.map((t, i) => (
              <View
                key={t}
                style={[
                  styles.favRow,
                  i > 0 && { borderTopWidth: 1, borderTopColor: c.rule },
                ]}
              >
                <Text
                  style={[styles.favText, { color: c.ink }]}
                  numberOfLines={2}
                >
                  {t}
                </Text>
                <Pressable
                  onPress={() => deleteFavorite(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`刪除：${t}`}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.favDelete,
                    pressed && { backgroundColor: c.raised },
                  ]}
                >
                  <Icon name="trash-outline" size={20} color={c.mute} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Sheet>

      <Sheet
        visible={sheet === "again"}
        onClose={closeSheet}
        title="請店員怎麼做？"
      >
        <Hint>
          只說「再說一次」，店員常常照原樣再講一遍。換一種請求通常更有用。
        </Hint>
        {AGAIN_CHOICES.map((x, i) => (
          <Button
            key={x.how}
            label={x.label}
            icon={x.icon}
            variant={i === 0 ? "primary" : "secondary"}
            size="lg"
            onPress={() => again(x.how)}
          />
        ))}
      </Sheet>

      <Sheet
        visible={sheet === "amount"}
        onClose={closeSheet}
        title="店員說多少錢？"
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="輸入數字"
          placeholderTextColor={c.mute}
          inputMode="numeric"
          keyboardType="number-pad"
          autoFocus
          style={[
            styles.input,
            { color: c.ink, borderColor: c.border, backgroundColor: c.ground },
          ]}
          accessibilityLabel="金額"
          onSubmitEditing={sendManualAmount}
        />
        <Button
          label="放大給店員確認"
          variant="primary"
          size="lg"
          onPress={sendManualAmount}
          disabled={!/\d/.test(draft)}
        />
      </Sheet>

      <Sheet
        visible={sheet === "store"}
        onClose={closeSheet}
        title="現在在哪一種櫃檯？"
      >
        <StoreGrid
          compact
          stores={STORES.filter((x) => !settings.hiddenStores.includes(x.id))}
          selectedId={store}
          onSelect={changeStore}
        />
      </Sheet>

      <Sheet visible={sheet === "more"} onClose={closeSheet} title="更多">
        <Button
          label={
            mic.state === "listening" || mic.state === "starting"
              ? "停止語音辨識"
              : "開始語音辨識"
          }
          icon={mic.state === "listening" ? "mic-off-outline" : "mic-outline"}
          onPress={() => {
            closeSheet();
            toggleMic();
          }}
        />
        <Button
          label={hand ? "改成平放在櫃檯上（雙面畫面）" : "改成拿在手上"}
          icon={hand ? "tablet-landscape-outline" : "phone-portrait-outline"}
          onPress={() => {
            closeSheet();
            update({ holdMode: hand ? "flat" : "hand" });
          }}
        />
        <Button
          label="請店員自己點選問題"
          icon="hand-left-outline"
          onPress={openClerkPick}
        />
        <Button
          label="語音辨識狀態"
          icon="pulse-outline"
          onPress={() => setSheet("mic")}
        />
        <Button
          label="模擬店員說話（示範用）"
          icon="chatbubble-ellipses-outline"
          onPress={() => setSheet("demo")}
        />
        <Button
          label="設定"
          icon="settings-outline"
          onPress={() => {
            closeSheet();
            router.push("/settings");
          }}
        />
        <Button
          label="結束，回首頁"
          icon="log-out-outline"
          variant="ghost"
          onPress={end}
        />
      </Sheet>

      <Sheet
        visible={sheet === "demo"}
        onClose={closeSheet}
        title="模擬店員說話"
      >
        <Hint>還沒有語音辨識時，用這裡測試判斷邏輯。</Hint>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="輸入店員會說的話"
          placeholderTextColor={c.mute}
          style={[
            styles.input,
            { color: c.ink, borderColor: c.border, backgroundColor: c.ground },
          ]}
          accessibilityLabel="店員說的話"
          onSubmitEditing={() => {
            if (draft.trim()) handleUtterance(draft);
            closeSheet();
          }}
        />
        <View style={styles.chips}>
          {((demo as Record<string, string[]>)[store] ?? demo.other).map(
            (t) => (
              <Chip
                key={t}
                label={t}
                onPress={() => {
                  handleUtterance(t);
                  closeSheet();
                }}
              />
            ),
          )}
        </View>
        <Button
          label="送出"
          variant="primary"
          disabled={!draft.trim()}
          onPress={() => {
            handleUtterance(draft);
            closeSheet();
          }}
        />
      </Sheet>

      <Sheet
        visible={sheet === "wrong"}
        onClose={closeSheet}
        title="店員其實在問什麼？"
      >
        {!!guess && (
          <Hint>
            手機聽到：「{guess.heard}」。選對的問題，會記下來用來改進判斷。
          </Hint>
        )}
        <ScrollView style={styles.wrongList}>
          <Group>
            {cards
              .filter((x) => x.id !== guess?.got)
              .map((x, i) => (
                <Row
                  key={x.id}
                  first={i === 0}
                  title={x.question}
                  trailing="chevron"
                  onPress={() => correctGuess(x)}
                />
              ))}
            <Row
              title="都不是"
              subtitle="記下來就好，我自己處理"
              onPress={() => correctGuess(null)}
            />
          </Group>
        </ScrollView>
      </Sheet>

      <Sheet
        visible={sheet === "mic"}
        onClose={closeSheet}
        title={
          mic.state === "listening" ? "語音辨識正在運作" : "語音辨識目前不能用"
        }
      >
        {mic.state !== "listening" && (
          <Hint>{micErrorText(mic.error, mic.state)}</Hint>
        )}
        <Hint>
          {[
            `狀態：${mic.state}`,
            mic.error ? `錯誤代碼：${mic.error}` : null,
            webSpeechInfo()
              ? `瀏覽器支援：${webSpeechInfo()!.supported ? "是" : "否"}・從主畫面開啟：${webSpeechInfo()!.standalone ? "是" : "否"}`
              : null,
          ]
            .filter(Boolean)
            .join("\n")}
        </Hint>
        <Hint>
          不用擔心，手動模式一樣可以用：點選店員問的問題，或按「打字」。
        </Hint>
        {mic.state === "error" && (
          <Button
            label="再試一次"
            icon="refresh-outline"
            variant="primary"
            onPress={() => {
              closeSheet();
              void mic.start();
            }}
          />
        )}
      </Sheet>

      <ShowToClerk
        visible={showing}
        view={clerk}
        scale={clerkScale}
        onDismiss={() => setShowing(false)}
        onSpeak={speakClerk}
        onClerkPick={() => {
          setShowing(false);
          setTimeout(openClerkPick, 300);
        }}
      />

      <ClerkPick
        upright={hand}
        visible={clerkPick}
        cards={cards}
        onPick={clerkPicked}
        onAmount={(value) => {
          setClerkPick(false);
          applyResult("", { kind: "amount", amount: value, perJin: false });
        }}
        onCancel={() => setClerkPick(false)}
      />

      <CallAlert
        visible={state.callAlert}
        who={callWho}
        onDismiss={() => dispatch({ type: "dismissCall" })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // 琥珀色分隔線 = 櫃檯邊緣；深色模式下兩半底色接近，靠它分開
  clerkArea: {
    flex: 42,
    backgroundColor: sign.bg,
    borderBottomWidth: 4,
    borderBottomColor: sign.hue,
  },
  user: { flex: 58 },
  statusbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  stage: { flex: 1 },
  stageContent: { gap: space.md, paddingBottom: space.lg },
  // 即時字幕：店員說的話要一眼看得到
  heard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderLeftWidth: 4,
    paddingLeft: space.md,
    paddingVertical: space.xs,
  },
  heardText: { flex: 1 },
  actions: {
    flexDirection: "row",
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
  },
  againButton: { flex: 2.6, paddingHorizontal: space.sm, gap: 6 },
  sideButton: { flex: 1, paddingHorizontal: space.sm },
  moreButton: { width: 52, paddingHorizontal: 0 },
  input: {
    borderWidth: 1.5,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 17,
    minHeight: 48,
  },
  textarea: { minHeight: 96, textAlignVertical: "top" },
  wrongList: { maxHeight: 420 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  favList: { borderWidth: 1, borderRadius: radius.card, overflow: "hidden" },
  favRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.md,
    minHeight: 52,
  },
  favText: { flex: 1, fontSize: 17 },
  favDelete: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.control,
  },
});
