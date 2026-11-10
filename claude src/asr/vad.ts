// 找出「一句話」：聲音比背景大就算開始說話，安靜 1.2 秒算說完。
// 背景音量會自己學（櫃檯旁邊的冰箱、音樂），所以門檻跟著環境走。
// 純邏輯，不碰麥克風；錄音在 cloud-listener.ts。

export type VadEvent = { type: 'start' } | { type: 'end'; samples: Float32Array };

export type VadOptions = {
  /** 安靜多久算說完 */
  silenceMs?: number;
  /** 說話至少要這麼長，不然當成碰撞聲 */
  minSpeechMs?: number;
  /** 一句最長，超過就先送出 */
  maxMs?: number;
  /** 開始說話前多留一點，免得吃掉第一個字 */
  preRollMs?: number;
};

const rms = (f: Float32Array) => Math.sqrt(f.reduce((s, x) => s + x * x, 0) / Math.max(1, f.length));

export function createVad(rate: number, opts: VadOptions = {}) {
  const { silenceMs = 1200, minSpeechMs = 250, maxMs = 12000, preRollMs = 300 } = opts;
  let floor = 0.01;
  let speaking = false;
  let started = false;
  let voicedMs = 0;
  let quietMs = 0;
  let totalMs = 0;
  let pre: Float32Array[] = [];
  let preMs = 0;
  let chunks: Float32Array[] = [];

  const join = () => {
    const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  };

  const reset = () => {
    speaking = false;
    started = false;
    voicedMs = quietMs = totalMs = preMs = 0;
    pre = [];
    chunks = [];
  };

  function push(frame: Float32Array): VadEvent[] {
    const ms = (frame.length / rate) * 1000;
    const level = rms(frame);
    const loud = level > Math.max(0.015, floor * 3);
    // 背景音量：安靜時慢慢跟上，說話時幾乎不動
    if (!loud) floor = floor * 0.95 + level * 0.05;
    else if (!speaking) floor = floor * 0.995 + level * 0.005;

    if (!speaking) {
      pre.push(frame);
      preMs += ms;
      while (preMs - (pre[0].length / rate) * 1000 >= preRollMs) preMs -= (pre.shift()!.length / rate) * 1000;
      if (!loud) {
        voicedMs = 0;
        return [];
      }
      voicedMs += ms;
      if (voicedMs < minSpeechMs) return [];
      speaking = true;
      chunks = pre;
      pre = [];
      preMs = 0;
      quietMs = 0;
      totalMs = chunks.reduce((n, c) => n + (c.length / rate) * 1000, 0);
      if (started) return [];
      started = true;
      return [{ type: 'start' }];
    }

    chunks.push(frame);
    totalMs += ms;
    quietMs = loud ? 0 : quietMs + ms;
    if (quietMs >= silenceMs || totalMs >= maxMs) {
      const samples = join();
      reset();
      return [{ type: 'end', samples }];
    }
    return [];
  }

  return { push, reset };
}
