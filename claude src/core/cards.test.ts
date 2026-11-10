import { describe, expect, test } from 'vitest';
import { BUILTIN_CARDS, STORES, cardsForStore, mergeCards, normalizeCard, optionsFor } from './cards';
import type { Card } from './types';

const userCard = (over: Partial<Card>): Card => ({
  id: 'x',
  stores: ['*'],
  question: '問題？',
  keywords: [],
  priority: 10,
  options: [],
  source: 'user',
  ...over,
});

describe('builtin data', () => {
  test('card ids are unique', () => {
    const ids = BUILTIN_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every card has 2–5 options so the typing option keeps the total ≤ 6', () => {
    for (const c of BUILTIN_CARDS) {
      expect(c.options.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.options.length, c.id).toBeLessThanOrEqual(5);
    }
  });

  test('every followup points to an existing card', () => {
    const ids = new Set(BUILTIN_CARDS.map((c) => c.id));
    for (const c of BUILTIN_CARDS)
      for (const o of c.options) if (o.followup) expect(ids.has(o.followup), `${c.id}→${o.followup}`).toBe(true);
  });

  test('every card belongs to a known store or is generic', () => {
    const storeIds = new Set(STORES.map((s) => s.id));
    for (const c of BUILTIN_CARDS) for (const s of c.stores) expect(s === '*' || storeIds.has(s), c.id).toBe(true);
  });

  test('stores are sorted by order', () => {
    expect(STORES.map((s) => s.id)).toEqual(['cvs', 'drink', 'breakfast', 'pharmacy', 'market', 'buffet', 'salon', 'other']);
  });
});

describe('normalizeCard', () => {
  test('show and tts default to the label', () => {
    const c = normalizeCard({ id: 'a', stores: ['*'], question: 'q', keywords: [], priority: 1, options: [{ label: '要' }] });
    expect(c.options[0]).toEqual({ label: '要', show: '要', tts: '要' });
    expect(c.source).toBe('builtin');
  });
});

describe('cardsForStore', () => {
  test('lists store cards before generic cards', () => {
    const ids = cardsForStore(BUILTIN_CARDS, 'drink').map((c) => c.id);
    expect(ids.slice(0, 6)).toEqual(['temp', 'icelevel', 'sugar', 'size', 'topping', 'second']);
    expect(ids).toContain('carrier');
    expect(ids).not.toContain('heat');
  });

  test('a store with no own cards gets only generic cards', () => {
    expect(cardsForStore(BUILTIN_CARDS, 'other').every((c) => c.stores.includes('*'))).toBe(true);
  });

  test('skips disabled cards', () => {
    const cards = [userCard({ id: 'a' }), userCard({ id: 'b', disabled: true })];
    expect(cardsForStore(cards, 'cvs').map((c) => c.id)).toEqual(['a']);
  });
});

describe('mergeCards', () => {
  test('a user card replaces the builtin card with the same id', () => {
    const merged = mergeCards(BUILTIN_CARDS, [userCard({ id: 'bag', question: '要袋子嗎？' })]);
    expect(merged.filter((c) => c.id === 'bag')).toHaveLength(1);
    expect(merged.find((c) => c.id === 'bag')!.question).toBe('要袋子嗎？');
  });

  test('new user cards are appended', () => {
    const merged = mergeCards(BUILTIN_CARDS, [userCard({ id: 'mine' })]);
    expect(merged.at(-1)!.id).toBe('mine');
    expect(merged).toHaveLength(BUILTIN_CARDS.length + 1);
  });
});

describe('optionsFor', () => {
  test('always ends with the typing option', () => {
    const card = BUILTIN_CARDS.find((c) => c.id === 'bag')!;
    const opts = optionsFor(card);
    expect(opts.at(-1)).toMatchObject({ label: '我打字說明', kind: 'type' });
    expect(opts).toHaveLength(card.options.length + 1);
  });
});
