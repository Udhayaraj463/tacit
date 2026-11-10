import { COUNT_UNITS, charAfter, findMoneyWords } from './lexicon';
import { numbersIn } from './numbers';
import { containsSound, syllables } from './pinyin';

export type CallTarget = {
  number?: string;
  name?: string;
  /** 名字拼音需要對中的比例，1 = 全部（同音字仍算對中） */
  nameThreshold?: number;
};

export function matchCall(text: string, target: CallTarget): 'number' | 'name' | null {
  if (target.number && matchNumber(text, parseInt(target.number, 10))) return 'number';
  if (target.name && matchName(text, target.name, target.nameThreshold ?? 1)) return 'name';
  return null;
}

function matchNumber(text: string, n: number): boolean {
  if (Number.isNaN(n)) return false;
  const hasMoney = findMoneyWords(text).length > 0;
  return numbersIn(text).some((tok) => {
    if (tok.value !== n) return false;
    const next = charAfter(text, tok.end);
    if (next === '號') return true;
    return !COUNT_UNITS.includes(next || '\0') && !hasMoney;
  });
}

function matchName(text: string, name: string, threshold: number): boolean {
  return containsSound(syllables(text), syllables(name), threshold);
}
