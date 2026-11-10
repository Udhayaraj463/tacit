// 櫃檯模式用的辨識 hook。Expo Go 沒有辨識的原生模組，這時退回手動模式，不讓 App 壞掉。
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { createRecognizer, type Recognizer, type RecognizerState, type SpeechModule } from './recognizer';

function loadSpeechModule(): SpeechModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition').ExpoSpeechRecognitionModule as SpeechModule;
  } catch {
    return null;
  }
}

export const speechModule = loadSpeechModule();

/** 網頁（尤其 iPhone Safari）只能在使用者點擊時開始收音，不能進畫面就自動開始 */
export const NEEDS_TAP_TO_LISTEN = Platform.OS === 'web';

export type MicState = RecognizerState | 'unsupported';

/** 網頁版的診斷資訊：瀏覽器有沒有辨識功能、是不是從主畫面圖示開的（iPhone 的主畫面網頁 App 常常不給辨識） */
export function webSpeechInfo(): { supported: boolean; standalone: boolean } | null {
  if (Platform.OS !== 'web') return null;
  const w = globalThis as unknown as {
    webkitSpeechRecognition?: unknown;
    SpeechRecognition?: unknown;
    navigator?: { standalone?: boolean };
    matchMedia?: (q: string) => { matches: boolean };
  };
  return {
    supported: w.webkitSpeechRecognition !== undefined || w.SpeechRecognition !== undefined,
    standalone: w.navigator?.standalone === true || !!w.matchMedia?.('(display-mode: standalone)').matches,
  };
}

export function useRecognizer(onFinal: (text: string, confidence?: number) => void) {
  const [state, setState] = useState<MicState>(speechModule ? 'idle' : 'unsupported');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognizer | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    if (!speechModule) return;
    const rec = createRecognizer(speechModule, {
      onPartial: setPartial,
      onFinal: (text, conf) => {
        setPartial('');
        onFinalRef.current(text, conf);
      },
      onState: (s) => {
        setState(s);
        if (s === 'listening') setError(null);
        if (s !== 'listening') setPartial('');
      },
      onError: setError,
    }, { askPermission: !NEEDS_TAP_TO_LISTEN });
    recRef.current = rec;
    return () => {
      rec.stop();
      recRef.current = null;
    };
  }, []);

  const start = useCallback(() => recRef.current?.start() ?? Promise.resolve(false), []);
  const stop = useCallback(() => recRef.current?.stop(), []);
  const setMuted = useCallback((m: boolean) => recRef.current?.setMuted(m), []);
  const setHints = useCallback((h: string[]) => recRef.current?.setHints(h), []);

  return { state, partial, error, start, stop, setMuted, setHints };
}

/** 辨識不能用的原因，給使用者看 */
export function micErrorText(code: string | null, state: MicState): string {
  const web = webSpeechInfo();
  if (web?.standalone) return '你是從主畫面的圖示打開的。iPhone 在這種模式下通常不提供語音辨識，請改用 Safari 直接打開網址（visible-dialog.expo.app）。';
  if (web && !web.supported) return '這個瀏覽器沒有語音辨識功能。iPhone 請用 Safari 打開；不要用 LINE、Instagram 裡的瀏覽器或 iPhone 上的 Chrome。';
  if (state === 'unsupported') return '這個版本沒有語音辨識（例如在 Expo Go 裡）。iPhone 請改用 Safari 打開網頁版；Android 請安裝我們的 App。手動模式可以照常點選問題。';
  switch (code) {
    case 'needs-tap':
      return 'iPhone 的 Safari 需要你點一下才能繼續聽。請點狀態列的「點我繼續聽」。';
    case 'not-allowed':
      return '沒有麥克風或語音辨識權限。請按下面「再試一次」，跳出詢問時選「允許」。如果沒有跳出來，請到手機「設定」裡打開這個 App（或 Safari）的麥克風權限。';
    case 'service-not-allowed':
      return 'iPhone 的 Safari 語音辨識要靠 Siri，只開「聽寫」不夠。請到「設定 → Siri」把 Siri 打開（開「按下側邊按鈕來使用 Siri」就可以），再按「再試一次」。如果有用「螢幕使用時間」，也要確認「內容與隱私權限制 → 允許的 App」裡的「Siri 與聽寫」沒有關掉。Android：請確認有安裝 Google App。';
    case 'language-not-supported':
      return '這支手機不支援中文（台灣）的語音辨識。';
    case 'network':
      return '網路連不上。這支手機的語音辨識需要網路。';
    case 'audio-capture':
      return '麥克風被其他 App 佔用了，請關掉正在錄音或通話的 App。';
    default:
      return '語音辨識啟動失敗。';
  }
}
