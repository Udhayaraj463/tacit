import { expect, test } from 'vitest';
import { signLines } from './sign-text';

test('breaks at the comma and drops it, like a sign', () => {
  expect(signLines('我是聽障者，請對著手機說話')).toBe('我是聽障者\n請對著手機說話');
});

test('keeps text without a comma on one line', () => {
  expect(signLines('有載具嗎？')).toBe('有載具嗎？');
});

test('handles half-width commas and spaces', () => {
  expect(signLines('不好意思, 可以再說一次嗎？')).toBe('不好意思\n可以再說一次嗎？');
});
