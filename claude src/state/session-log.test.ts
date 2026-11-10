import { describe, expect, test } from 'vitest';
import { allDosages, misheardReport, recentLine, summarize, type Session } from './session-log';

const session = (events: Session['events'], id = '2026-10-23T10:00:00.000Z'): Session => ({ id, store: 'cvs', events });

describe('summarize', () => {
  test('pairs each answer with the question before it', () => {
    const s = summarize(
      session([
        { t: 0, type: 'heard', text: '有載具嗎' },
        { t: 1, type: 'card', id: 'carrier', question: '有載具嗎？', by: 'rule' },
        { t: 2, type: 'answer', text: '手機條碼' },
        { t: 3, type: 'card', id: 'bag', question: '需要袋子嗎？', by: 'manual' },
        { t: 4, type: 'answer', text: '不用' },
      ]),
    );
    expect(s.qa).toEqual([
      { q: '有載具嗎？', a: '手機條碼' },
      { q: '需要袋子嗎？', a: '不用' },
    ]);
  });

  test('a question without an answer is left out', () => {
    expect(summarize(session([{ t: 0, type: 'card', id: 'bag', question: '需要袋子嗎？', by: 'rule' }])).qa).toEqual([]);
  });

  test('amounts carry their confirmation result', () => {
    const s = summarize(
      session([
        { t: 0, type: 'amount', value: 235, perJin: false },
        { t: 1, type: 'amountConfirm', ok: false, value: 235 },
        { t: 2, type: 'amount', value: 245, perJin: false },
        { t: 3, type: 'amountConfirm', ok: true, value: 245 },
      ]),
    );
    expect(s.amounts).toEqual([
      { value: 235, perJin: false, confirmed: false },
      { value: 245, perJin: false, confirmed: true },
    ]);
  });

  test('typed messages are listed', () => {
    expect(summarize(session([{ t: 0, type: 'typed', text: '我要這個' }])).typed).toEqual(['我要這個']);
  });
});

describe('allDosages', () => {
  test('collects only saved dosages, newest session first', () => {
    const older = session(
      [
        { t: 0, type: 'dosage', text: '一天三次飯後吃' },
        { t: 1, type: 'dosageSaved' },
      ],
      '2026-10-20T10:00:00.000Z',
    );
    const newer = session(
      [
        { t: 0, type: 'dosage', text: '睡前一顆' },
        { t: 1, type: 'dosageSaved' },
        { t: 2, type: 'dosage', text: '沒存的' },
      ],
      '2026-10-22T10:00:00.000Z',
    );
    expect(allDosages([older, newer])).toEqual([
      { text: '睡前一顆', sessionId: newer.id },
      { text: '一天三次飯後吃', sessionId: older.id },
    ]);
  });
});

describe('recentLine', () => {
  const s = (events: Session['events']) => ({ id: '2026-10-23T10:00:00.000Z', store: 'drink', events });

  test('lists the answers and the confirmed amount', () => {
    const line = recentLine(
      s([
        { t: 0, type: 'card', id: 'icelevel', question: '冰塊要多少？', by: 'rule' },
        { t: 1, type: 'answer', text: '少冰' },
        { t: 2, type: 'card', id: 'sugar', question: '甜度？', by: 'rule' },
        { t: 3, type: 'answer', text: '半糖' },
        { t: 4, type: 'amount', value: 65, perJin: false },
        { t: 5, type: 'amountConfirm', ok: true, value: 65 },
      ]),
    );
    expect(line).toBe('少冰、半糖・NT$ 65');
  });

  test('shortens long answer lists', () => {
    const events: Session['events'] = [];
    ['a', 'b', 'c', 'd', 'e'].forEach((x, i) => {
      events.push({ t: i, type: 'card', id: x, question: x, by: 'rule' }, { t: i, type: 'answer', text: x });
    });
    expect(recentLine(s(events))).toBe('a、b、c 等 5 項');
  });

  test('says so when nothing was answered', () => {
    expect(recentLine(s([]))).toBe('沒有回答任何問題');
  });
});

describe('misheardReport', () => {
  const s = (events: Session['events'], id = '2026-10-25T10:00:00.000Z'): Session => ({ id, store: 'cvs', events });

  test('lists each correction with what was heard, what the app thought and what it really was', () => {
    const report = misheardReport([
      s([{ t: 0, type: 'misheard', heard: '有在句嗎', got: 'points', actual: 'carrier' }]),
    ]);
    expect(report.count).toBe(1);
    expect(report.text).toContain('有在句嗎');
    expect(report.text).toContain('points → carrier');
    expect(report.text).toContain('cvs');
  });

  test('a correction with no matching question says so', () => {
    const report = misheardReport([s([{ t: 0, type: 'misheard', heard: '要不要幫你包起來', got: 'unknown', actual: null }])]);
    expect(report.text).toContain('unknown → （不在問題列表）');
  });

  test('masks long digit runs such as phone numbers', () => {
    const report = misheardReport([s([{ t: 0, type: 'misheard', heard: '電話0912345678', got: 'unknown', actual: null }])]);
    expect(report.text).not.toContain('0912345678');
    expect(report.text).toContain('***');
  });

  test('is empty when nothing was corrected', () => {
    expect(misheardReport([s([])])).toEqual({ count: 0, text: '' });
  });
});
