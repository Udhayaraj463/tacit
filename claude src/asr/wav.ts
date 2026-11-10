// 把錄到的聲音變成 16kHz 單聲道 WAV（base64），送給雲端判斷。
// 用 WAV 而不是瀏覽器內建的壓縮格式：iPhone Safari 錄出來是 mp4，Gemini 不一定收；WAV 一定收。

/** 線性內插降頻（店員說話用 16kHz 綽綽有餘，檔案小三倍） */
export function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const j = Math.floor(pos);
    const next = input[Math.min(j + 1, input.length - 1)];
    out[i] = input[j] + (next - input[j]) * (pos - j);
  }
  return out;
}

export function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 單聲道
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const v = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  });
  return bytes;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** 不依賴 btoa / Buffer，網頁與伺服器都能用 */
export function toBase64(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out.push(
      ALPHABET[a >> 2],
      ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)],
      b === undefined ? '=' : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)],
      c === undefined ? '=' : ALPHABET[c & 63],
    );
  }
  return out.join('');
}
