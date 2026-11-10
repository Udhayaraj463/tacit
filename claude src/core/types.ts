export type StoreId = string;

export type Store = {
  id: StoreId;
  name: string;
  hint: string;
  order: number;
};

export type CardOption = {
  /** 使用者面按鈕文字 */
  label: string;
  /** 店員面大字顯示 */
  show: string;
  /** 唸出來的文字 */
  tts: string;
  /** 選了之後接著問的卡 id */
  followup?: string;
  /** 'type' = 開打字面板，不是一般答案 */
  kind?: 'answer' | 'type';
};

export type Card = {
  id: string;
  /** ['*'] = 通用卡 */
  stores: StoreId[];
  question: string;
  keywords: string[];
  priority: number;
  options: CardOption[];
  source: 'builtin' | 'user' | 'shop';
  disabled?: boolean;
};
