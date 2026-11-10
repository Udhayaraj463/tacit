import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRecognizer, type SpeechModule } from './recognizer';

type Listener = (e: any) => void;

function fakeModule(opts: { granted?: boolean; available?: boolean } = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const mod = {
    starts: 0,
    stops: 0,
    lastOptions: null as any,
    requestPermissionsAsync: vi.fn(async () => ({ granted: opts.granted ?? true })),
    isRecognitionAvailable: () => opts.available ?? true,
    start(o: any) {
      mod.starts++;
      mod.lastOptions = o;
    },
    stop() {
      mod.stops++;
    },
    abort() {},
    addListener(name: string, cb: Listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(cb);
      return { remove: () => listeners.get(name)!.delete(cb) };
    },
    emit(name: string, e: any = {}) {
      listeners.get(name)?.forEach((cb) => cb(e));
    },
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
  return mod;
}

const result = (transcript: string, isFinal: boolean, confidence = 0.9) => ({ isFinal, results: [{ transcript, confidence }] });

function setup(opts?: Parameters<typeof fakeModule>[0], recOpts?: { askPermission?: boolean }) {
  const mod = fakeModule(opts);
  const events = { partial: [] as string[], final: [] as [string, number | undefined][], states: [] as string[], errors: [] as string[] };
  const rec = createRecognizer(mod as unknown as SpeechModule, {
    onPartial: (t) => events.partial.push(t),
    onFinal: (t, c) => events.final.push([t, c]),
    onState: (s) => events.states.push(s),
    onError: (code) => events.errors.push(code),
  }, recOpts);
  return { mod, rec, events };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('recognizer', () => {
  test('starts listening in zh-TW with interim results and phrase hints', async () => {
    const { mod, rec, events } = setup();
    expect(await rec.start()).toBe(true);
    mod.emit('start');
    expect(mod.starts).toBe(1);
    expect(mod.lastOptions).toMatchObject({ lang: 'zh-TW', interimResults: true });
    expect(mod.lastOptions.contextualStrings).toContain('載具');
    expect(events.states.at(-1)).toBe('listening');
  });

  test('a denied permission reports not-allowed and never starts', async () => {
    const { mod, rec, events } = setup({ granted: false });
    expect(await rec.start()).toBe(false);
    expect(mod.starts).toBe(0);
    expect(events.errors).toEqual(['not-allowed']);
    expect(events.states.at(-1)).toBe('error');
  });

  test('an unavailable recognizer reports service-not-allowed', async () => {
    const { rec, events } = setup({ available: false });
    expect(await rec.start()).toBe(false);
    expect(events.errors).toEqual(['service-not-allowed']);
  });

  test('partial results go to onPartial, final results to onFinal', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('result', result('有載', false, 0));
    mod.emit('result', result('有載具嗎', true, 0.82));
    expect(events.partial).toEqual(['有載']);
    expect(events.final).toEqual([['有載具嗎', 0.82]]);
  });

  test('confidence of 0 or -1 means unavailable', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('result', result('甲', true, 0));
    mod.emit('result', result('乙', true, -1));
    expect(events.final).toEqual([
      ['甲', undefined],
      ['乙', undefined],
    ]);
  });

  test('empty final transcripts are ignored', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('result', result('  ', true));
    expect(events.final).toEqual([]);
  });

  test('restarts after the session ends while still active', async () => {
    const { mod, rec } = setup();
    await rec.start();
    mod.emit('end');
    vi.advanceTimersByTime(300);
    expect(mod.starts).toBe(2);
  });

  test('does not restart after stop()', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    rec.stop();
    mod.emit('end');
    vi.advanceTimersByTime(1000);
    expect(mod.starts).toBe(1);
    expect(events.states.at(-1)).toBe('idle');
  });

  test('benign errors (no speech) just restart', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('error', { error: 'no-speech' });
    mod.emit('end');
    vi.advanceTimersByTime(300);
    expect(mod.starts).toBe(2);
    expect(events.errors).toEqual([]);
  });

  test('fatal errors stop listening and are reported', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('error', { error: 'not-allowed' });
    mod.emit('end');
    vi.advanceTimersByTime(1000);
    expect(mod.starts).toBe(1);
    expect(events.errors).toEqual(['not-allowed']);
    expect(events.states.at(-1)).toBe('error');
  });

  test('a partial that stops changing for 1.5 s is cut into a sentence (clerks pause mid-sentence)', async () => {
    const { mod, rec } = setup();
    await rec.start();
    mod.emit('result', result('要加蛋嗎', false, 0));
    vi.advanceTimersByTime(1200);
    expect(mod.stops).toBe(0);
    vi.advanceTimersByTime(300);
    expect(mod.stops).toBe(1);
  });

  test('phrase hints can be set per store and are used on the next start', async () => {
    const { mod, rec } = setup();
    rec.setHints(['去冰', '微糖']);
    await rec.start();
    expect(mod.lastOptions.contextualStrings).toEqual(expect.arrayContaining(['去冰', '微糖']));
    expect(mod.lastOptions.contextualStrings).toContain('載具');
  });

  test('a changing partial keeps the sentence open', async () => {
    const { mod, rec } = setup();
    await rec.start();
    mod.emit('result', result('要加', false, 0));
    vi.advanceTimersByTime(700);
    mod.emit('result', result('要加蛋嗎', false, 0));
    vi.advanceTimersByTime(700);
    expect(mod.stops).toBe(0);
  });

  test('results are ignored while muted (our own text-to-speech)', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    rec.setMuted(true);
    mod.emit('result', result('不用謝謝', true));
    rec.setMuted(false);
    mod.emit('result', result('有載具嗎', true));
    expect(events.final.map(([t]) => t)).toEqual(['有載具嗎']);
  });

  test('without a permission step, start() reaches the engine in the same tap (Safari needs this)', () => {
    const { mod, rec } = setup({}, { askPermission: false });
    void rec.start();
    expect(mod.starts).toBe(1);
    expect(mod.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test('a permission error after it was already listening asks for a tap instead', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('start');
    mod.emit('end');
    vi.advanceTimersByTime(300);
    mod.emit('error', { error: 'not-allowed' });
    expect(events.errors).toEqual(['needs-tap']);
    expect(events.states.at(-1)).toBe('error');
  });

  // Android：講完被切斷時，常常只有中間結果、沒有最後結果（或最後結果是空的）。
  // 這時要用最後一次的中間結果當作這句話，不然畫面看得到字卻不會跳出卡片。
  test('a session that ends with only a partial still delivers that sentence', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('result', result('有載具嗎', false, 0));
    mod.emit('end');
    expect(events.final).toEqual([['有載具嗎', undefined]]);
  });

  test('an empty final after a partial uses the partial', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('result', result('有載具嗎', false, 0));
    mod.emit('result', result('', true, 0));
    mod.emit('end');
    expect(events.final).toEqual([['有載具嗎', undefined]]);
  });

  test('a no-match error after a partial still delivers it once', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('result', result('有載具嗎', false, 0));
    mod.emit('error', { error: 'no-match' });
    mod.emit('end');
    expect(events.final).toEqual([['有載具嗎', undefined]]);
  });

  test('a real final is not delivered twice when the session ends', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    mod.emit('result', result('有載', false, 0));
    mod.emit('result', result('有載具嗎', true, 0.9));
    mod.emit('end');
    expect(events.final).toEqual([['有載具嗎', 0.9]]);
  });

  test('a partial heard while muted is not delivered at the end', async () => {
    const { mod, rec, events } = setup();
    await rec.start();
    rec.setMuted(true);
    mod.emit('result', result('謝謝光臨', false, 0));
    mod.emit('end');
    expect(events.final).toEqual([]);
  });

  test('stop() removes all listeners', async () => {
    const { mod, rec } = setup();
    await rec.start();
    rec.stop();
    expect(mod.listenerCount()).toBe(0);
  });
});
