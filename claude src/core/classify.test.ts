import { describe, expect, test } from 'vitest';
import scripts from '../../test/scripts.json';
import { BUILTIN_CARDS } from './cards';
import { classify, type ClassifyContext } from './classify';

const ctx = (store: string, over: Partial<ClassifyContext> = {}): ClassifyContext => ({
  store,
  cards: BUILTIN_CARDS,
  call: { number: scripts.callNumber },
  ...over,
});

describe('scripts.json: cards', () => {
  test.each(scripts.cards)('$store「$text」→ $expect', ({ store, text, expect: id }) => {
    const r = classify(text, ctx(store));
    expect(r.kind === 'card' && r.card.id).toBe(id);
  });
});

describe('scripts.json: misheard words still find the card (by sound)', () => {
  test.each(scripts.misheard)('$store「$text」→ $expect（$why）', ({ store, text, expect: id }) => {
    const r = classify(text, ctx(store));
    expect(r.kind === 'card' && r.card.id).toBe(id);
  });

  test.each(scripts.soundalikeNegatives)('$store「$text」stays unknown（$why）', ({ store, text }) => {
    expect(classify(text, ctx(store)).kind).toBe('unknown');
  });

  test('invoice questions go to the carrier card', () => {
    // 發票的問題都交給載具這張卡（手機條碼／紙本發票／不用）；捐發票沒人用，拿掉了
    const r = classify('發票要印嗎', ctx('cvs'));
    expect(r.kind === 'card' && r.card.id).toBe('carrier');
  });
});

describe('scripts.json: amounts', () => {
  test.each(scripts.amounts)('$store「$text」→ $amount', ({ store, text, amount, perJin }) => {
    expect(classify(text, ctx(store))).toMatchObject({ kind: 'amount', amount, perJin: perJin ?? false });
  });
});

describe('scripts.json: calls', () => {
  test.each(scripts.calls)('「%s」→ call', (text) => {
    expect(classify(text, ctx('cvs')).kind).toBe('call');
  });

  test.each(scripts.interference)('「%s」is not a call', (text) => {
    expect(classify(text, ctx('cvs')).kind).not.toBe('call');
  });
});

describe('scripts.json: dosage', () => {
  test.each(scripts.dosage)('「$text」→ dosage', ({ store, text }) => {
    expect(classify(text, ctx(store))).toEqual({ kind: 'dosage', text });
  });
});

describe('scripts.json: unknown never guesses', () => {
  test.each(scripts.unknown)('$store「$text」→ unknown', ({ store, text }) => {
    expect(classify(text, ctx(store))).toEqual({ kind: 'unknown', text, askLLM: true });
  });
});

describe('classify rules', () => {
  test('dosage words only count in the pharmacy', () => {
    expect(classify('一天三次', ctx('cvs')).kind).toBe('unknown');
  });

  test('a store card wins over a generic card', () => {
    // 「醬」是早餐店卡，「外帶」是通用卡
    const r = classify('外帶要加醬嗎', ctx('breakfast'));
    expect(r.kind === 'card' && r.card.id).toBe('sauce');
  });

  test('the longest keyword wins between cards of the same tier', () => {
    const r = classify('要雲端發票嗎', ctx('other'));
    expect(r.kind === 'card' && r.card.id).toBe('carrier');
  });

  test('with equal tier and keyword length, the higher priority wins', () => {
    const card = (id: string, priority: number) => ({
      id, stores: ['*'], question: id, keywords: ['測試'], priority, options: [], source: 'user' as const,
    });
    const r = classify('測試', ctx('cvs', { cards: [card('low', 5), card('high', 10)] }));
    expect(r.kind === 'card' && r.card.id).toBe('high');
  });

  test('cards of other stores are ignored', () => {
    expect(classify('要加熱嗎', ctx('drink')).kind).toBe('unknown');
  });

  test('keywords match case-insensitively', () => {
    const r = classify('可以用LINE Pay嗎', ctx('cvs'));
    expect(r.kind === 'card' && r.card.id).toBe('pay');
  });

  test('a number followed by 斤 is a weight, not an amount', () => {
    expect(classify('要兩斤嗎', ctx('market')).kind).not.toBe('amount');
  });

  test('equally close numbers are offered as candidates', () => {
    expect(classify('235元還是245元', ctx('cvs'))).toMatchObject({ kind: 'amount', candidates: [235, 245] });
  });

  test('a call is detected before an amount', () => {
    expect(classify('42號總共100元', ctx('cvs')).kind).toBe('call');
  });

  test('empty text is unknown without asking the LLM', () => {
    expect(classify('  ', ctx('cvs'))).toEqual({ kind: 'unknown', text: '', askLLM: false });
  });
});

describe('recognition confidence', () => {
  test('below 0.4 is unknown and not sent to the LLM', () => {
    expect(classify('有載具嗎', ctx('cvs', { confidence: 0.3 }))).toEqual({
      kind: 'unknown',
      text: '有載具嗎',
      askLLM: false,
    });
  });

  test('0 means the engine gave no confidence, so it is ignored', () => {
    expect(classify('有載具嗎', ctx('cvs', { confidence: 0 })).kind).toBe('card');
  });

  test('a call still alerts at low confidence', () => {
    expect(classify('42號', ctx('cvs', { confidence: 0.2 })).kind).toBe('call');
  });
});
