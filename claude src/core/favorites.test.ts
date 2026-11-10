import { describe, expect, test } from 'vitest';
import { MAX_FAVORITES, MAX_FAVORITE_LEN, addFavorite, favoritesFor, removeFavorite, usingSuggested } from './favorites';

describe('favorites', () => {
  test('a store with nothing saved has an empty list', () => {
    expect(favoritesFor({}, 'drink')).toEqual([]);
  });

  test('new lines go first, per store', () => {
    let f = addFavorite({}, 'drink', '珍珠奶茶 大杯 半糖少冰');
    f = addFavorite(f, 'drink', '紅茶 去冰');
    f = addFavorite(f, 'cvs', '不用袋子');
    expect(favoritesFor(f, 'drink')).toEqual(['紅茶 去冰', '珍珠奶茶 大杯 半糖少冰']);
    expect(favoritesFor(f, 'cvs')).toEqual(['不用袋子']);
  });

  test('extra spaces are tidied and a repeat moves to the front', () => {
    let f = addFavorite({}, 'drink', '綠茶  無糖');
    f = addFavorite(f, 'drink', '紅茶');
    f = addFavorite(f, 'drink', ' 綠茶 無糖 ');
    expect(favoritesFor(f, 'drink')).toEqual(['綠茶 無糖', '紅茶']);
  });

  test('blank and too-long lines are not saved', () => {
    const f = { drink: ['紅茶'] };
    expect(addFavorite(f, 'drink', '   ')).toBe(f);
    expect(addFavorite(f, 'drink', '字'.repeat(MAX_FAVORITE_LEN + 1))).toBe(f);
  });

  test('keeps at most the newest few', () => {
    let f = {};
    for (let i = 0; i < MAX_FAVORITES + 3; i++) f = addFavorite(f, 'drink', `第${i}杯`);
    const list = favoritesFor(f, 'drink');
    expect(list).toHaveLength(MAX_FAVORITES);
    expect(list[0]).toBe(`第${MAX_FAVORITES + 2}杯`);
  });

  describe('suggested lines', () => {
    const tips = ['大杯，半糖少冰', '中杯，無糖去冰'];

    test('a store nobody touched shows the suggestions', () => {
      expect(favoritesFor({}, 'drink', tips)).toEqual(tips);
      expect(usingSuggested({}, 'drink')).toBe(true);
    });

    test('adding the first own line keeps the suggestions after it', () => {
      const f = addFavorite({}, 'drink', '紅茶 去冰', tips);
      expect(favoritesFor(f, 'drink', tips)).toEqual(['紅茶 去冰', ...tips]);
      expect(usingSuggested(f, 'drink')).toBe(false);
    });

    test('a suggestion can be deleted, and deleting all of them does not bring them back', () => {
      let f = removeFavorite({}, 'drink', tips[0], tips);
      expect(favoritesFor(f, 'drink', tips)).toEqual([tips[1]]);
      f = removeFavorite(f, 'drink', tips[1], tips);
      expect(favoritesFor(f, 'drink', tips)).toEqual([]);
    });
  });

  test('remove takes out only that line', () => {
    const f = { drink: ['紅茶', '綠茶'], cvs: ['紅茶'] };
    expect(removeFavorite(f, 'drink', '紅茶')).toEqual({ drink: ['綠茶'], cvs: ['紅茶'] });
    expect(removeFavorite(f, 'drink', '奶茶')).toBe(f);
  });
});
