// 店員端的金額鍵盤：自己畫的按鍵，能跟著畫面翻 180°（系統鍵盤不行）。
export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'del' | 'clear';

const MAX_DIGITS = 6;

export function pressKey(current: string, key: Key | string): string {
  if (key === 'clear') return '';
  if (key === 'del') return current.slice(0, -1);
  if (!/^\d$/.test(key)) return current;
  if (current === '' && key === '0') return '';
  return current.length >= MAX_DIGITS ? current : current + key;
}
