// 用發音比對：辨識引擎常把字聽錯（載具 → 在句、統編 → 通編），但發音是對的。
import { pinyin } from 'pinyin-pro';

// 台灣口音常混：zh/z、ch/c、sh/s、ing/in、eng/en
function fuzzySyllable(s: string): string {
  return s.replace(/^([zcs])h/, '$1').replace(/([ei])ng$/, '$1n');
}

/** 中文字轉成不帶聲調、容許口音的音節；非中文字拿掉 */
export function syllables(text: string): string[] {
  return pinyin(text, { toneType: 'none', type: 'array', nonZh: 'removed' }).map(fuzzySyllable);
}

/** hay 裡有沒有一段連續音節，跟 want 至少 threshold 比例相同 */
export function containsSound(hay: string[], want: string[], threshold = 1): boolean {
  if (!want.length || hay.length < want.length) return false;
  for (let i = 0; i + want.length <= hay.length; i++) {
    const same = want.filter((s, j) => hay[i + j] === s).length;
    if (same / want.length >= threshold) return true;
  }
  return false;
}

const cache = new Map<string, string[]>();
/** 關鍵字的音節（關鍵字固定，存起來不用每次重算） */
export function keywordSyllables(keyword: string): string[] {
  let v = cache.get(keyword);
  if (!v) {
    v = syllables(keyword);
    cache.set(keyword, v);
  }
  return v;
}
