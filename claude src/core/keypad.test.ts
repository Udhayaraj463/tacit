import { describe, expect, test } from 'vitest';
import { pressKey } from './keypad';

describe('pressKey (the clerk amount keypad)', () => {
  test('appends digits', () => {
    expect(['2', '3', '5'].reduce(pressKey, '')).toBe('235');
  });

  test('ignores leading zeros', () => {
    expect(['0', '0', '7'].reduce(pressKey, '')).toBe('7');
  });

  test('stops at six digits', () => {
    expect(['1', '2', '3', '4', '5', '6', '7'].reduce(pressKey, '')).toBe('123456');
  });

  test('backspace removes the last digit', () => {
    expect(pressKey('235', 'del')).toBe('23');
    expect(pressKey('', 'del')).toBe('');
  });

  test('clear empties it', () => {
    expect(pressKey('235', 'clear')).toBe('');
  });
});
