import { describe, expect, test } from 'vitest';
import { createVad, type VadEvent } from './vad';
import { downsample, encodeWav, toBase64 } from './wav';

const RATE = 16000;
const FRAME = 1600; // 100ms
const frame = (amp: number) => Float32Array.from({ length: FRAME }, (_, i) => amp * Math.sin(i / 3));
const quiet = () => frame(0.002);
const loud = () => frame(0.3);

function feed(vad: ReturnType<typeof createVad>, frames: Float32Array[]): VadEvent[] {
  return frames.flatMap((f) => vad.push(f));
}

describe('vad', () => {
  test('a sentence then a pause becomes one utterance', () => {
    const vad = createVad(RATE);
    const ev = feed(vad, [...Array(5)].map(quiet).concat([...Array(10)].map(loud), [...Array(15)].map(quiet)));
    expect(ev.map((e) => e.type)).toEqual(['start', 'end']);
    const end = ev[1] as Extract<VadEvent, { type: 'end' }>;
    // 包含開頭前 0.3 秒、說話 1 秒、句尾 1.2 秒
    expect(end.samples.length).toBeGreaterThanOrEqual(FRAME * 10);
    expect(end.samples.length).toBeLessThanOrEqual(FRAME * (3 + 10 + 13));
  });

  test('a short click is not speech', () => {
    const vad = createVad(RATE);
    const ev = feed(vad, [quiet(), quiet(), loud(), ...[...Array(20)].map(quiet)]);
    expect(ev.map((e) => e.type)).not.toContain('end');
  });

  test('a very long utterance is cut at the limit', () => {
    const vad = createVad(RATE, { maxMs: 3000 });
    const ev = feed(vad, [...Array(40)].map(loud));
    expect(ev.filter((e) => e.type === 'end').length).toBeGreaterThanOrEqual(1);
    const end = ev.find((e) => e.type === 'end') as Extract<VadEvent, { type: 'end' }>;
    expect(end.samples.length).toBeLessThanOrEqual(RATE * 3.5);
  });

  test('steady background noise does not count as speech', () => {
    const vad = createVad(RATE);
    const noise = () => frame(0.03);
    const ev = feed(vad, [...Array(60)].map(noise));
    expect(ev.filter((e) => e.type === 'end')).toHaveLength(0);
  });

  test('speech over background noise still ends', () => {
    const vad = createVad(RATE);
    const noise = () => frame(0.03);
    const ev = feed(vad, [...Array(30)].map(noise).concat([...Array(10)].map(() => frame(0.3)), [...Array(15)].map(noise)));
    expect(ev.map((e) => e.type)).toEqual(['start', 'end']);
  });

  test('reset drops a half-heard sentence', () => {
    const vad = createVad(RATE);
    feed(vad, [...Array(5)].map(loud));
    vad.reset();
    expect(feed(vad, [...Array(15)].map(quiet)).map((e) => e.type)).toEqual([]);
  });
});

// Node 的 Buffer 當標準答案（測試只在 Node 跑）
const nodeBase64 = (bytes: Uint8Array) =>
  (globalThis as unknown as { Buffer: { from(b: Uint8Array): { toString(enc: string): string } } }).Buffer.from(bytes).toString('base64');

describe('wav', () => {
  test('downsample keeps the length ratio', () => {
    expect(downsample(new Float32Array(48000), 48000, 16000)).toHaveLength(16000);
    expect(downsample(new Float32Array(441), 44100, 16000)).toHaveLength(160);
  });

  test('same rate is unchanged', () => {
    const x = Float32Array.from([0.1, 0.2]);
    expect(downsample(x, 16000, 16000)).toBe(x);
  });

  test('encodeWav writes a 16-bit mono header', () => {
    const bytes = encodeWav(Float32Array.from([0, 1, -1]), 16000);
    const view = new DataView(bytes.buffer);
    const str = (o: number) => String.fromCharCode(...bytes.slice(o, o + 4));
    expect(str(0)).toBe('RIFF');
    expect(str(8)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
    expect(bytes.length).toBe(44 + 6);
  });

  test('toBase64 matches the standard encoding', () => {
    const text = new TextEncoder().encode('RIFF wave!');
    expect(toBase64(text)).toBe(nodeBase64(text));
    const big = Uint8Array.from({ length: 100_000 }, (_, i) => i % 251);
    expect(toBase64(big)).toBe(nodeBase64(big));
  });
});
