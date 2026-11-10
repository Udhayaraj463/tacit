// 辨識層（SPEC §7.3）：start / stop / onPartial / onFinal。換引擎不動其他程式。
// 用「一句一句」的方式聽：每句結束就重開，iOS 與 Android 行為一致；
// 中間結果停住不動 1 秒就當作一句話說完（店員講完不會等 3 秒）。

export type RecognizerState = 'idle' | 'starting' | 'listening' | 'error';

export type RecognizerHandlers = {
  onPartial: (text: string) => void;
  onFinal: (text: string, confidence?: number) => void;
  onState: (state: RecognizerState) => void;
  onError: (code: string) => void;
};

/** expo-speech-recognition 用到的那一小部分，測試時可以換成假的。 */
export type SpeechModule = {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  isRecognitionAvailable(): boolean;
  start(options: Record<string, unknown>): void;
  stop(): void;
  addListener(event: string, cb: (e: any) => void): { remove(): void };
};

export type Recognizer = {
  start(): Promise<boolean>;
  stop(): void;
  /** 我們自己唸答案時暫停收音，免得把 TTS 當成店員說話 */
  setMuted(muted: boolean): void;
  /** 這間店的常用詞，下次開始聽時交給引擎當提示 */
  setHints(hints: string[]): void;
};

/** 詞彙提示（SPEC §7.4）：雲端與 iOS 引擎會偏向這些詞 */
export const PHRASE_HINTS = ['載具', '統編', '寄杯', '去冰', '少冰', '微糖', '半糖', '無糖', '半價', '集點', '加熱', '健保卡', '飯後'];

/** 店員講到一半會換氣，1.5 秒沒變才當作一句說完 */
const SILENCE_MS = 1500;
const RESTART_MS = 250;
/** 這些錯誤代表這支手機現在不能辨識，退回手動模式 */
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported', 'audio-capture', 'network']);

const OPTIONS = {
  lang: 'zh-TW',
  interimResults: true,
  continuous: false,
  maxAlternatives: 1,
  contextualStrings: PHRASE_HINTS,
  requiresOnDeviceRecognition: false,
  addsPunctuation: false,
  // 讓 TTS 從喇叭出來、麥克風加降噪
  iosCategory: { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth'], mode: 'measurement' },
  iosVoiceProcessingEnabled: true,
  androidIntentOptions: {
    EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1200,
    EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1200,
  },
};

export type RecognizerOptions = {
  /**
   * 先跟系統要權限再開始。網頁版要關掉：Safari 只允許在「手指點下去的那一刻」開始收音，
   * 先 await 權限就會錯過那一刻；網頁的權限是開始收音時由瀏覽器自己問。
   */
  askPermission?: boolean;
};

export function createRecognizer(mod: SpeechModule, h: RecognizerHandlers, opts: RecognizerOptions = {}): Recognizer {
  const askPermission = opts.askPermission ?? true;
  let active = false;
  /** 這次開啟後是否真的開始聽過；聽過之後才被擋，代表是「重開需要再點一下」 */
  let everListened = false;
  let muted = false;
  let hints: string[] = [];
  let lastPartial = '';
  let subs: { remove(): void }[] = [];
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (restartTimer) clearTimeout(restartTimer);
    silenceTimer = restartTimer = null;
  };

  const detach = () => {
    subs.forEach((s) => s.remove());
    subs = [];
  };

  const fail = (code: string) => {
    active = false;
    clearTimers();
    detach();
    h.onError(code);
    h.onState('error');
  };

  const begin = () => {
    lastPartial = '';
    try {
      mod.start({ ...OPTIONS, contextualStrings: [...new Set([...PHRASE_HINTS, ...hints])] });
    } catch {
      fail('service-not-allowed');
    }
  };

  const onResult = (e: { isFinal: boolean; results?: { transcript?: string; confidence?: number }[] }) => {
    if (muted) return;
    const r = e.results?.[0];
    const text = r?.transcript?.trim() ?? '';
    if (!e.isFinal) {
      if (!text || text === lastPartial) return;
      lastPartial = text;
      h.onPartial(text);
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => mod.stop(), SILENCE_MS);
      return;
    }
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = null;
    // Android 被切斷時，最後結果常常是空的：用剛剛看到的中間結果
    const sentence = text || lastPartial;
    lastPartial = '';
    if (!sentence) return;
    const conf = text ? r?.confidence : undefined;
    h.onFinal(sentence, conf !== undefined && conf > 0 ? conf : undefined);
  };

  /** 這一輪結束了卻沒有最後結果（Android 常見）：把畫面上看得到的那句當作店員說的話 */
  const flushPartial = () => {
    const sentence = lastPartial;
    lastPartial = '';
    if (sentence && !muted) h.onFinal(sentence, undefined);
  };

  return {
    async start() {
      if (active) return true;
      if (askPermission) {
        const perm = await mod.requestPermissionsAsync().catch(() => ({ granted: false }));
        if (!perm.granted) {
          fail('not-allowed');
          return false;
        }
      }
      if (!mod.isRecognitionAvailable()) {
        fail('service-not-allowed');
        return false;
      }
      active = true;
      everListened = false;
      subs = [
        mod.addListener('start', () => {
          everListened = true;
          h.onState('listening');
        }),
        mod.addListener('result', onResult),
        mod.addListener('error', (e: { error: string }) => {
          if (!FATAL.has(e.error)) return;
          const blockedRestart = everListened && (e.error === 'not-allowed' || e.error === 'service-not-allowed');
          fail(blockedRestart ? 'needs-tap' : e.error);
        }),
        mod.addListener('end', () => {
          if (silenceTimer) clearTimeout(silenceTimer);
          silenceTimer = null;
          flushPartial();
          if (active) restartTimer = setTimeout(begin, RESTART_MS);
        }),
      ];
      h.onState('starting');
      begin();
      return true;
    },

    stop() {
      active = false;
      clearTimers();
      detach();
      try {
        mod.stop();
      } catch {}
      h.onState('idle');
    },

    setHints(list: string[]) {
      hints = list;
    },

    setMuted(m: boolean) {
      muted = m;
      if (m && silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      lastPartial = '';
    },
  };
}
