// 我的常點：每種櫃檯各存幾句常用的話（例如飲料店「珍珠奶茶 大杯 半糖少冰」），到櫃檯點一下就給店員看。
// 只存在這支手機（跟著設定一起存）。
import type { StoreId } from './types';

export type Favorites = Record<StoreId, string[]>;

/** 一種櫃檯最多幾句：再多就要捲動，在櫃檯前找不到 */
export const MAX_FAVORITES = 8;
/** 一句最長幾個字：店員那面要一眼看完 */
export const MAX_FAVORITE_LEN = 40;

/**
 * 這種櫃檯的常點。還沒動過的櫃檯先用預設的建議句（suggested）；
 * 一旦加過或刪過，就只用使用者自己的清單（刪光了也不會再跑出建議句）。
 */
export const favoritesFor = (favs: Favorites, store: StoreId, suggested: string[] = []): string[] => favs[store] ?? suggested;

/** 這種櫃檯是不是還在用建議句 */
export const usingSuggested = (favs: Favorites, store: StoreId): boolean => favs[store] === undefined;

/** 加在最前面；同一句已經有了就移到最前面。空白或太長的不收。第一次加時，建議句會留著。 */
export function addFavorite(favs: Favorites, store: StoreId, raw: string, suggested: string[] = []): Favorites {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text || [...text].length > MAX_FAVORITE_LEN) return favs;
  const rest = favoritesFor(favs, store, suggested).filter((t) => t !== text);
  return { ...favs, [store]: [text, ...rest].slice(0, MAX_FAVORITES) };
}

export function removeFavorite(favs: Favorites, store: StoreId, text: string, suggested: string[] = []): Favorites {
  const list = favoritesFor(favs, store, suggested);
  if (!list.includes(text)) return favs;
  return { ...favs, [store]: list.filter((t) => t !== text) };
}
