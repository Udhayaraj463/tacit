import rawCards from '../data/cards.json';
import rawStores from '../data/stores.json';
import { TYPE_OPTION_LABEL } from '../i18n/zh-TW';
import type { Card, CardOption, Store, StoreId } from './types';

type RawOption = { label: string; show?: string; tts?: string; followup?: string };
type RawCard = Omit<Card, 'options' | 'source'> & { options: RawOption[]; source?: Card['source'] };

export function normalizeCard(raw: RawCard): Card {
  return {
    ...raw,
    source: raw.source ?? 'builtin',
    options: raw.options.map((o) => ({ ...o, show: o.show ?? o.label, tts: o.tts ?? o.label })),
  };
}

export const BUILTIN_CARDS: Card[] = (rawCards as RawCard[]).map(normalizeCard);
export const STORES: Store[] = [...(rawStores as Store[])].sort((a, b) => a.order - b.order);

const isGeneric = (c: Card) => c.stores.includes('*');

/** 這間店可用的卡：店專屬在前、通用在後。 */
export function cardsForStore(cards: Card[], store: StoreId): Card[] {
  const enabled = cards.filter((c) => !c.disabled);
  return [
    ...enabled.filter((c) => !isGeneric(c) && c.stores.includes(store)),
    ...enabled.filter(isGeneric),
  ];
}

/** 使用者自訂卡與內建卡合併；同 id 以使用者版為準。 */
export function mergeCards(builtin: Card[], user: Card[]): Card[] {
  const byId = new Map(user.map((c) => [c.id, c]));
  const merged = builtin.map((c) => byId.get(c.id) ?? c);
  const builtinIds = new Set(builtin.map((c) => c.id));
  return [...merged, ...user.filter((c) => !builtinIds.has(c.id))];
}

const TYPE_OPTION: CardOption = { label: TYPE_OPTION_LABEL, show: '', tts: '', kind: 'type' };

/** 卡片的選項，最後永遠接「我打字說明」。 */
export function optionsFor(card: Card): CardOption[] {
  return [...card.options, TYPE_OPTION];
}
