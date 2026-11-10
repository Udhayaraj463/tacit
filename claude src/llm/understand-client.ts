// App 端：問雲端「店員在問哪一題」。逾時、沒網路、伺服器錯誤都回 null，畫面維持「不確定」。
import { Platform } from 'react-native';
import type { UnderstandAnswer, UnderstandRequest } from '../core/understand';

/** 網頁版跟伺服器同一個網址；Android App 要寫完整網址 */
const ENDPOINT = Platform.OS === 'web' ? '/api/understand' : 'https://visible-dialog.expo.app/api/understand';

/** 文字很快；錄音要上傳加轉文字，給久一點 */
export const TEXT_TIMEOUT_MS = 2500;
export const AUDIO_TIMEOUT_MS = 8000;

export async function understand(req: UnderstandRequest): Promise<UnderstandAnswer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), req.audio ? AUDIO_TIMEOUT_MS : TEXT_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<UnderstandAnswer>;
    if (typeof data.transcript !== 'string' || (data.cardId !== null && typeof data.cardId !== 'string')) return null;
    return { transcript: data.transcript, cardId: data.cardId ?? null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
