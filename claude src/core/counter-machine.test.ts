import { describe, expect, test } from 'vitest';
import { BUILTIN_CARDS, optionsFor } from './cards';
import { clerkSpeech, clerkView, counterReducer, initialCounter, type CounterAction, type CounterState } from './counter-machine';

const card = (id: string) => BUILTIN_CARDS.find((c) => c.id === id)!;
const run = (...actions: CounterAction[]): CounterState => actions.reduce(counterReducer, initialCounter);
const INTRO = '我是聽障者，請對著手機說話';

describe('counterReducer', () => {
  test('starts idle with the intro on the clerk side', () => {
    expect(initialCounter.screen).toEqual({ type: 'idle' });
    expect(clerkView(initialCounter, INTRO)).toMatchObject({ main: INTRO, sub: '我會用螢幕回答您' });
  });

  test('a recognized card shows options to the user and the question to the clerk', () => {
    const s = run({ type: 'heard', text: '有載具嗎', result: { kind: 'card', card: card('carrier'), keyword: '載具' } });
    expect(s.screen).toEqual({ type: 'card', card: card('carrier') });
    expect(s.heard).toBe('有載具嗎');
    expect(clerkView(s, INTRO)).toMatchObject({ label: '我正在看您的問題', main: '有載具嗎？' });
  });

  test('answering shows the option show-text big on the clerk side', () => {
    const egg = card('egg');
    const s = run({ type: 'pickCard', card: egg }, { type: 'answer', option: egg.options[0] });
    expect(s.screen).toEqual({ type: 'card', card: egg, chosen: egg.options[0] });
    expect(clerkView(s, INTRO)).toMatchObject({ label: '我的回答', main: '要加蛋', sub: '要加蛋嗎？' });
  });

  test('an answer with a followup moves the user to the next card', () => {
    const temp = card('temp');
    const s = run({ type: 'pickCard', card: temp }, { type: 'answer', option: temp.options[0], next: card('icelevel') });
    expect(s.screen).toEqual({ type: 'card', card: card('icelevel') });
    expect(clerkView(s, INTRO).main).toBe('冰的');
  });

  test('the typing option does not count as an answer', () => {
    const bag = card('bag');
    const before = run({ type: 'pickCard', card: bag });
    expect(counterReducer(before, { type: 'answer', option: optionsFor(bag).at(-1)! })).toBe(before);
  });

  test('again keeps the card for the user and asks the clerk to repeat', () => {
    const s = run({ type: 'pickCard', card: card('bag') }, { type: 'again' });
    expect(s.screen).toEqual({ type: 'card', card: card('bag') });
    expect(clerkView(s, INTRO)).toMatchObject({ main: '可以再說一次嗎？', accent: true });
  });

  test.each([
    ['point', '可以指給我看嗎？'],
    ['rephrase', '可以換個說法嗎？'],
    ['write', '可以寫給我看嗎？'],
  ] as const)('again can ask the clerk to %s instead of repeating', (how, main) => {
    const s = run({ type: 'pickCard', card: card('bag') }, { type: 'again', how });
    expect(s.screen).toEqual({ type: 'card', card: card('bag') });
    expect(clerkView(s, INTRO)).toMatchObject({ main, accent: true });
  });

  test('unknown text is shown only to the user; the clerk side does not change', () => {
    const s = run({ type: 'pickCard', card: card('bag') }, { type: 'heard', text: '今天天氣很好', result: { kind: 'unknown', text: '今天天氣很好', askLLM: true } });
    expect(s.screen).toEqual({ type: 'unknown', text: '今天天氣很好' });
    expect(clerkView(s, INTRO).main).toBe('需要袋子嗎？');
  });

  test('a call raises the alert and keeps everything else', () => {
    const before = run({ type: 'pickCard', card: card('bag') });
    const s = counterReducer(before, { type: 'heard', text: '42號', result: { kind: 'call', by: 'number' } });
    expect(s.callAlert).toBe(true);
    expect(s.screen).toEqual(before.screen);
    expect(counterReducer(s, { type: 'dismissCall' })).toEqual({ ...s, callAlert: false });
  });

  test('done returns both sides to idle', () => {
    const s = run({ type: 'pickCard', card: card('bag') }, { type: 'again' }, { type: 'done' });
    expect(s).toEqual(initialCounter);
  });

  test('typed text is shown to the clerk', () => {
    const s = run({ type: 'typed', text: '我要這個' });
    expect(clerkView(s, INTRO)).toMatchObject({ label: '我想說', main: '我要這個' });
  });
});

describe('back', () => {
  test('from a picked card goes back to the question list', () => {
    const s = run({ type: 'pickCard', card: card('heat') }, { type: 'back' });
    expect(s.screen).toEqual({ type: 'idle' });
    expect(clerkView(s, INTRO).main).toBe(INTRO);
  });

  test('from a followup card goes back to the previous card and its answer', () => {
    const temp = card('temp');
    const s = run({ type: 'pickCard', card: temp }, { type: 'answer', option: temp.options[0], next: card('icelevel') }, { type: 'back' });
    expect(s.screen).toEqual({ type: 'card', card: temp, chosen: temp.options[0] });
    expect(clerkView(s, INTRO).main).toBe('冰的');
  });

  test('from a recognized card goes back to the card before it', () => {
    const s = run(
      { type: 'pickCard', card: card('bag') },
      { type: 'heard', text: '有載具嗎', result: { kind: 'card', card: card('carrier'), keyword: '載具' } },
      { type: 'back' },
    );
    expect(s.screen).toEqual({ type: 'card', card: card('bag') });
    expect(clerkView(s, INTRO).main).toBe('需要袋子嗎？');
  });

  test('from an amount goes back to the list', () => {
    const s = run({ type: 'heard', text: '總共235元', result: { kind: 'amount', amount: 235, perJin: false } }, { type: 'back' });
    expect(s.screen).toEqual({ type: 'idle' });
    expect(s.heard).toBe('');
  });

  test('at the list does nothing', () => {
    expect(counterReducer(initialCounter, { type: 'back' })).toBe(initialCounter);
  });

  test('a call alert does not add a step', () => {
    const s = run({ type: 'pickCard', card: card('bag') }, { type: 'heard', text: '42號', result: { kind: 'call', by: 'number' } }, { type: 'back' });
    expect(s.screen).toEqual({ type: 'idle' });
  });

  test('done forgets the steps', () => {
    const s = run({ type: 'pickCard', card: card('bag') }, { type: 'pickCard', card: card('heat') }, { type: 'done' });
    expect(s.history).toEqual([]);
  });
});

describe('amount flow', () => {
  const heardAmount = (amount: number, perJin = false, candidates?: number[]): CounterAction => ({
    type: 'heard',
    text: '總共',
    result: { kind: 'amount', amount, perJin, ...(candidates && { candidates }) },
  });

  test('shows the amount big on both sides', () => {
    const s = run(heardAmount(235));
    expect(s.screen).toEqual({ type: 'amount', amount: 235, perJin: false });
    expect(clerkView(s, INTRO)).toMatchObject({ label: '金額是這樣嗎？', main: '235 元', big: true });
  });

  test('per-jin prices say so', () => {
    expect(clerkView(run(heardAmount(80, true)), INTRO).main).toBe('每斤 80 元');
  });

  test('confirming marks the amount and shows a check to the clerk', () => {
    const s = run(heardAmount(235), { type: 'amountConfirm', ok: true });
    expect(s.screen).toMatchObject({ type: 'amount', amount: 235, confirmed: true });
    expect(clerkView(s, INTRO)).toMatchObject({ main: '235 元 ✓', big: true });
  });

  test('picking one of several candidates confirms that value', () => {
    const s = run(heardAmount(235, false, [235, 245]), { type: 'amountConfirm', ok: true, value: 245 });
    expect(s.screen).toMatchObject({ amount: 245, confirmed: true });
    expect(clerkView(s, INTRO).main).toBe('245 元 ✓');
  });

  test('rejecting asks the clerk to repeat the amount', () => {
    const s = run(heardAmount(235), { type: 'amountConfirm', ok: false });
    expect(s.screen).toMatchObject({ confirmed: false });
    expect(clerkView(s, INTRO)).toMatchObject({ main: '可以再說一次金額嗎？', accent: true });
  });
});

describe('dosage flow', () => {
  test('shows the dosage and marks it saved', () => {
    const s = run({ type: 'heard', text: '一天三次飯後吃', result: { kind: 'dosage', text: '一天三次飯後吃' } }, { type: 'dosageSaved' });
    expect(s.screen).toEqual({ type: 'dosage', text: '一天三次飯後吃', saved: true });
    expect(clerkView(s, INTRO)).toMatchObject({ label: '用法用量，我記下來了', main: '一天三次飯後吃' });
  });
});

describe('clerkSpeech', () => {
  test('the intro is read out as written', () => {
    expect(clerkSpeech(initialCounter, INTRO)).toBe(INTRO);
  });

  test('an answer is read with the card\'s spoken wording', () => {
    const egg = card('egg');
    const s = run({ type: 'pickCard', card: egg }, { type: 'answer', option: egg.options[1] });
    expect(clerkView(s, INTRO).main).toBe('不用');
    expect(clerkSpeech(s, INTRO)).toBe('不用，謝謝');
  });

  test('asking the clerk to point is read out too', () => {
    expect(clerkSpeech(run({ type: 'again', how: 'point' }), INTRO)).toBe('可以指給我看嗎？');
  });

  test('a confirmed amount is read without the check mark', () => {
    const s = run({ type: 'heard', text: '總共', result: { kind: 'amount', amount: 235, perJin: false } }, { type: 'amountConfirm', ok: true });
    expect(clerkSpeech(s, INTRO)).toBe('235 元');
  });

  test('typed and favorite lines are read as typed', () => {
    expect(clerkSpeech(run({ type: 'typed', text: '大杯，半糖少冰' }), INTRO)).toBe('大杯，半糖少冰');
  });
});
