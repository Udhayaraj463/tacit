// 設定（SPEC §9.4）：只存本機。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Favorites } from '../core/favorites';
import { DEFAULT_INTRO } from '../i18n/zh-TW';
import type { FontScaleIndex } from '../ui/theme';
import { migrateSettings } from './settings-migrate';

export type Haptics = 'off' | 'light' | 'strong';

/** 平放（預設）：雙面畫面，上半翻給店員；拿著：整個螢幕朝自己，要給店員看時轉過去 */
export type HoldMode = 'hand' | 'flat';

export type Settings = {
  introText: string;
  introName: string;
  ttsAuto: boolean;
  /** 進入櫃檯模式就開始聽 */
  autoListen: boolean;
  holdMode: HoldMode;
  fontScaleUser: FontScaleIndex;
  fontScaleClerk: FontScaleIndex;
  haptics: Haptics;
  hiddenStores: string[];
  lastStore: string;
  callNumber: string;
  callName: string;
  seenPlacementTip: boolean;
  /** 這支手機上次語音辨識失敗（例如 iPhone Safari 不給用）：下次直接把「請店員點選」放最前面 */
  speechBroken: boolean;
  /** 雲端判斷（Gemini）：規則聽不懂的句子送去判斷；iPhone 網頁版不能辨識時改用錄音。預設關，要使用者自己打開 */
  cloudHelp: boolean;
  /** 我的常點：每種櫃檯各自的常用句 */
  favorites: Favorites;
};

export const DEFAULT_SETTINGS: Settings = {
  introText: DEFAULT_INTRO,
  introName: '',
  ttsAuto: false,
  autoListen: true,
  holdMode: 'flat',
  fontScaleUser: 0,
  fontScaleClerk: 0,
  haptics: 'light',
  hiddenStores: [],
  lastStore: 'cvs',
  callNumber: '',
  callName: '',
  seenPlacementTip: false,
  speechBroken: false,
  cloudHelp: false,
  favorites: {},
};

const KEY = 'vd.settings';

type Ctx = { settings: Settings; update: (patch: Partial<Settings>) => void; ready: boolean };
const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSettings(migrateSettings(JSON.parse(raw), DEFAULT_SETTINGS)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update, ready }), [settings, update, ready]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
