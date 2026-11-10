import { describe, expect, test } from 'vitest';
import { matchCall } from './callmatch';

describe('matchCall by number', () => {
  const call = { number: '42' };

  test.each(['42號', '42 號', '四十二號', '請42號來拿', '四十二號請取餐', '42號你的餐好了', '四十二', '42', '號碼42'])(
    'hits: %s',
    (text) => {
      expect(matchCall(text, call)).toBe('number');
    },
  );

  test.each(['412號', '142號', '4號', '43號', '24號', '總共42元', '四十二塊', '一共四十二', '收你420', '42元'])(
    'does not hit: %s',
    (text) => {
      expect(matchCall(text, call)).toBeNull();
    },
  );

  test('does not hit when no call number is set', () => {
    expect(matchCall('42號', {})).toBeNull();
  });
});

describe('matchCall by name', () => {
  const call = { name: '陳小明' };

  test.each(['陳小明', '陳小明先生', '請陳小明來拿', '陳曉明', '程小明'])('hits homophones and accent variants: %s', (text) => {
    expect(matchCall(text, call)).toBe('name');
  });

  test.each(['王小明', '陳小美', '小明', '你好'])('does not hit: %s', (text) => {
    expect(matchCall(text, call)).toBeNull();
  });

  test('only eng/en and ing/in are treated as the same sound, not ang/an', () => {
    expect(matchCall('詹小明', { name: '張小明' })).toBeNull();
  });

  test('a lower threshold allows one wrong syllable', () => {
    expect(matchCall('王小明', { name: '陳小明', nameThreshold: 0.66 })).toBe('name');
  });

  test('number and name can both be set', () => {
    const both = { number: '42', name: '陳小明' };
    expect(matchCall('42號', both)).toBe('number');
    expect(matchCall('陳小明', both)).toBe('name');
  });
});
