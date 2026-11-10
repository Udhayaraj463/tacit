import { describe, expect, test } from 'vitest';
import { numbersIn, zhToNum } from './numbers';

describe('zhToNum', () => {
  test.each([
    ['五', 5],
    ['十五', 15],
    ['三十五', 35],
    ['四十二', 42],
    ['八十', 80],
    ['兩百', 200],
    ['一百零八', 108],
    ['兩百三十五', 235],
    ['一千零五', 1005],
    ['三千二百', 3200],
  ])('%s → %i', (zh, n) => {
    expect(zhToNum(zh)).toBe(n);
  });

  test.each([
    ['一百二', 120],
    ['兩百三', 230],
    ['一千二', 1200],
    ['一萬五', 15000],
  ])('colloquial trailing digit: %s → %i', (zh, n) => {
    expect(zhToNum(zh)).toBe(n);
  });

  test('一萬兩千三百 → 12300', () => {
    expect(zhToNum('一萬兩千三百')).toBe(12300);
  });

  test('returns null for text without numerals', () => {
    expect(zhToNum('你好')).toBeNull();
  });
});

describe('numbersIn', () => {
  test('finds Arabic numbers with positions', () => {
    expect(numbersIn('總共235元')).toEqual([{ value: 235, start: 2, end: 5 }]);
  });

  test('finds Chinese numbers', () => {
    expect(numbersIn('一共兩百三十五塊').map((n) => n.value)).toEqual([1, 235]);
  });

  test('finds several numbers in order', () => {
    expect(numbersIn('兩杯總共130').map((n) => n.value)).toEqual([2, 130]);
  });

  test('handles full-width digits and thousands separators', () => {
    expect(numbersIn('總共１,２００元').map((n) => n.value)).toEqual([1200]);
  });
});
