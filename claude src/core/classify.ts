import { cardsForStore } from './cards';
import { matchCall, type CallTarget } from './callmatch';
import { DOSAGE_WORDS, QUANTITY_UNITS, charAfter, findMoneyWords, textBefore } from './lexicon';
import { numbersIn, type NumberToken } from './numbers';
import { containsSound, keywordSyllables, syllables } from './pinyin';
import type { Card, StoreId } from './types';

export type ClassifyContext = {
  store: StoreId;
  cards: Card[];
  call: CallTarget;
  /** 辨識引擎給的信心值；0 或沒有 = 引擎沒提供 */
  confidence?: number;
};

export type ClassifyResult =
  | { kind: 'call'; by: 'number' | 'name' }
  | { kind: 'amount'; amount: number; perJin: boolean; candidates?: number[] }
  | { kind: 'dosage'; text: string }
  | { kind: 'card'; card: Card; keyword: string; bySound?: boolean; byModel?: boolean }
  | { kind: 'unknown'; text: string; askLLM: boolean };

const MIN_CONFIDENCE = 0.4;

/** 規則判斷（SPEC §8 第 1、2 層）。沒命中就回 unknown，絕不猜。 */
export function classify(rawText: string, ctx: ClassifyContext): ClassifyResult {
  const text = rawText.trim();
  if (!text) return { kind: 'unknown', text, askLLM: false };

  const by = matchCall(text, ctx.call);
  if (by) return { kind: 'call', by };

  if (ctx.confidence && ctx.confidence < MIN_CONFIDENCE) return { kind: 'unknown', text, askLLM: false };

  const amount = findAmount(text);
  if (amount) return amount;

  if (ctx.store === 'pharmacy' && DOSAGE_WORDS.test(text)) return { kind: 'dosage', text };

  const card = findCard(text, ctx);
  if (card) return card;

  return { kind: 'unknown', text, askLLM: true };
}

function gap(t: NumberToken, s: { start: number; end: number }): number {
  if (t.end <= s.start) return s.start - t.end;
  if (s.end <= t.start) return t.start - s.end;
  return 0;
}

function findAmount(text: string): Extract<ClassifyResult, { kind: 'amount' }> | null {
  const money = findMoneyWords(text);
  const nums = numbersIn(text).filter(
    (t) => !money.some((s) => t.start < s.end && t.end > s.start) && !QUANTITY_UNITS.includes(charAfter(text, t.end) || '\0'),
  );
  if (!nums.length) return null;

  if (money.length) {
    const dist = nums.map((t) => Math.min(...money.map((s) => gap(t, s))));
    const best = Math.min(...dist);
    const closest = [...new Set(nums.filter((_, i) => dist[i] === best).map((t) => t.value))];
    const result = { kind: 'amount' as const, amount: closest[0], perJin: false };
    return closest.length > 1 ? { ...result, candidates: closest } : result;
  }

  // 市場報價：「一斤八十」「每斤一百二」「兩斤一百六」
  const jinPrice = nums.find((t) => textBefore(text, t.start).endsWith('斤'));
  if (jinPrice) {
    return { kind: 'amount', amount: jinPrice.value, perJin: /[每一]斤$/.test(textBefore(text, jinPrice.start)) };
  }
  return null;
}

/** 字面命中 > 店專屬 > 命中字串長度 > 卡片優先權 */
type Score = [number, number, number, number];
const beats = (a: Score, b: Score) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

function findCard(text: string, ctx: ClassifyContext): Extract<ClassifyResult, { kind: 'card' }> | null {
  const lower = text.toLowerCase();
  let sound: string[] | null = null; // 需要時才轉拼音
  let best: { card: Card; keyword: string; score: Score; bySound: boolean } | null = null;
  for (const card of cardsForStore(ctx.cards, ctx.store)) {
    let bySound = false;
    let keyword = card.keywords
      .filter((k) => lower.includes(k.toLowerCase()))
      .reduce((a, b) => (b.length > a.length ? b : a), '');
    if (!keyword) {
      // 字面沒對上，改比發音；只比兩個音以上的關鍵字（單一個音的同音字太多）
      sound ??= syllables(text);
      keyword = card.keywords
        .filter((k) => keywordSyllables(k).length >= 2 && containsSound(sound!, keywordSyllables(k)))
        .reduce((a, b) => (b.length > a.length ? b : a), '');
      bySound = !!keyword;
    }
    if (!keyword) continue;
    const score: Score = [bySound ? 0 : 1, card.stores.includes('*') ? 0 : 1, keyword.length, card.priority];
    if (!best || beats(score, best.score)) best = { card, keyword, score, bySound };
  }
  return best && { kind: 'card', card: best.card, keyword: best.keyword, ...(best.bySound && { bySound: true }) };
}
