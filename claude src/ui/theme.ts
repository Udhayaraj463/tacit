// 設計 token：「無彩帳本」。介面本身沒有顏色：墨黑、石灰底、白色面板、1px 細邊、不用陰影。
// 唯一的色相（品牌暖橘，跟標誌同色）只住在給店員看的告示牌上，和叫號的全螢幕提醒。
// 對比度（WCAG）：文字 ≥ 4.5:1，可互動元件邊框 ≥ 3:1，light / dark 都量過。
import { useColorScheme, useWindowDimensions } from 'react-native';

const light = {
  /** 石灰：櫃檯檯面的顏色，低彩度，不是米黃 */
  ground: '#F4F3F1',
  surface: '#FFFFFF',
  /** 次要按鈕、按下、選取列：一階灰 */
  raised: '#EDEDEB',
  border: '#E3E2DF',
  rule: '#EFEEEC',
  /** 可互動元件的邊（≥ 3:1） */
  control: '#888680',
  ink: '#0A0A0A',
  mute: '#5F5E5A',
  /** 主要動作：近黑填色、白字 */
  primary: '#141414',
  onPrimary: '#FFFFFF',
  positive: '#22703A',
  positiveSoft: '#E1F3E6',
  negative: '#B3261E',
  negativeSoft: '#FCE9E7',
  scrim: 'rgba(10,10,10,0.5)',
};

const dark: typeof light = {
  ground: '#000000',
  surface: '#111111',
  raised: '#222222',
  border: '#2A2A2A',
  rule: '#1C1C1C',
  control: '#6E6E6E',
  ink: '#FFFFFF',
  mute: '#B4B4B4',
  primary: '#FFFFFF',
  onPrimary: '#0A0A0A',
  positive: '#4CC37A',
  positiveSoft: '#14261B',
  negative: '#F2786D',
  negativeSoft: '#2C1715',
  scrim: 'rgba(0,0,0,0.7)',
};

/** 店員面：不跟系統深淺色切換，深底白字、暖橘重點——在櫃檯燈光下一公尺外最好讀。 */
export const sign = {
  bg: '#0B0B0C',
  fg: '#FFFFFF',
  mute: '#B9B9B9',
  /** 品牌暖橘（標誌同色）：整個 App 唯一的色相。黑底上 8.3:1 */
  hue: '#FF8A1F',
  onHue: '#0A0A0A',
};

export type Colors = typeof light;

/** 4 的倍數 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** 緊的一組：面板 8、控制項 6 */
export const radius = { card: 8, control: 6, sheet: 12 } as const;

/** 字級：12 / 14 / 16 / 20 / 24，數字另計 */
export const type = { small: 13, body: 16, label: 14, option: 20, title: 24 } as const;

/** 數字用 Atkinson Hyperlegible Mono：專為辨識度設計的字形，235 / 245 不會看錯；等寬，對得齊。 */
export const fonts = {
  numeric: 'AtkinsonHyperlegibleMono_500Medium',
  /** 店員面：思源黑體 Medium。筆畫乾淨，不用加粗就夠清楚 */
  sign: 'NotoSansTC_500Medium',
} as const;

/** 標準 / 大 / 特大 */
export const fontScales = [1, 1.15, 1.3] as const;
export type FontScaleIndex = 0 | 1 | 2;

export const MIN_TOUCH = 48;

/** 動畫時長：進場比退場慢一點；減少動態效果時一律不動 */
export const motion = { enter: 200, exit: 150 } as const;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/** 內容欄最寬 560，寬螢幕（網頁版在電腦上看）時左右留同樣的邊、內容置中 */
export const CONTENT_MAX = 560;
export function useGutter(): number {
  const { width } = useWindowDimensions();
  return Math.max(space.lg, (width - CONTENT_MAX) / 2);
}
