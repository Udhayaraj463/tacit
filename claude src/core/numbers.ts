// 中文數字與阿拉伯數字解析。店員常講口語數字：「一百二」= 120、「兩百三」= 230。

const DIGITS: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const WAN = '萬';

export function zhToNum(s: string): number | null {
  let total = 0;
  let section = 0;
  let num = 0;
  let lastUnit = 0;
  let prevWasUnit = false;
  let digitFollowsUnit = false;
  let seen = false;

  for (const ch of s) {
    if (ch in DIGITS) {
      num = DIGITS[ch];
      digitFollowsUnit = prevWasUnit && num !== 0;
      prevWasUnit = false;
      seen = true;
    } else if (ch in UNITS) {
      section += (num || 1) * UNITS[ch];
      num = 0;
      lastUnit = UNITS[ch];
      prevWasUnit = true;
      digitFollowsUnit = false;
      seen = true;
    } else if (ch === WAN) {
      total += (section + num || 1) * 10000;
      section = 0;
      num = 0;
      lastUnit = 10000;
      prevWasUnit = true;
      digitFollowsUnit = false;
      seen = true;
    }
  }
  if (!seen) return null;
  // 口語省略：「一百二」的「二」是十位，「一萬五」的「五」是千位
  if (num && digitFollowsUnit && lastUnit >= 100) num *= lastUnit / 10;
  return total + section + num;
}

export type NumberToken = { value: number; start: number; end: number };

const NUMBER_RE = /\d[\d,]*\d|\d|[零〇一二兩三四五六七八九十百千萬]+/g;

function toHalfWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

export function numbersIn(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  const normalized = toHalfWidthDigits(text);
  for (const m of normalized.matchAll(NUMBER_RE)) {
    const raw = m[0];
    const value = /\d/.test(raw) ? parseInt(raw.replace(/,/g, ''), 10) : zhToNum(raw);
    if (value === null || Number.isNaN(value)) continue;
    out.push({ value, start: m.index, end: m.index + raw.length });
  }
  return out;
}
