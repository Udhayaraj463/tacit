// 雲端判斷（SPEC §8 第 3 層，用 Gemini）。規則判斷不出來時才問；這裡只放純邏輯，
// 伺服器端在 src/app/api/understand+api.ts，App 端在 src/llm/understand-client.ts。
// 模型只能從這間店的卡片裡選一張，或回答 none；選不出來就維持「不確定」，絕不猜。
import type { ClassifyResult } from './classify';
import type { Card, StoreId } from './types';

/** 店員一句話不會超過這個長度；也防止別人拿這個網址當免費的聊天機器人 */
export const MAX_TEXT = 120;
/** 約 13 秒的 16kHz 單聲道 WAV（base64 後）。錄音那邊一句最長 12 秒 */
export const MAX_AUDIO_B64 = 560_000;

export type UnderstandRequest =
  | { store: StoreId; text: string; audio?: undefined }
  | { store: StoreId; audio: { mime: 'audio/wav'; data: string }; text?: undefined };

export type UnderstandAnswer = { transcript: string; cardId: string | null };

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function checkRequest(body: unknown, storeIds: string[]): { ok: true; req: UnderstandRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body' };
  const b = body as Record<string, unknown>;
  if (typeof b.store !== 'string' || !storeIds.includes(b.store)) return { ok: false, error: 'store' };
  const hasText = b.text !== undefined;
  const hasAudio = b.audio !== undefined;
  if (hasText === hasAudio) return { ok: false, error: 'text-or-audio' };
  if (hasText) {
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text || text.length > MAX_TEXT) return { ok: false, error: 'text' };
    return { ok: true, req: { store: b.store, text } };
  }
  const a = b.audio as Record<string, unknown> | null;
  if (!a || a.mime !== 'audio/wav' || typeof a.data !== 'string') return { ok: false, error: 'audio' };
  // 只檢查開頭：伺服器每次只有約 10ms 的 CPU（EAS Hosting 免費方案），不逐字掃整段
  if (a.data.length > MAX_AUDIO_B64 || !BASE64.test(a.data.slice(0, 64))) return { ok: false, error: 'audio' };
  return { ok: true, req: { store: b.store, audio: { mime: 'audio/wav', data: a.data } } };
}

export function buildPrompt(cards: Card[], heard?: string): string {
  const list = cards.map((c) => `- ${c.id}：${c.question}`).join('\n');
  const input = heard
    ? `店員剛剛說（語音辨識的結果，可能有同音錯字）：「${heard}」`
    : '附上的錄音是店員剛剛說的一句話。先把它逐字寫成繁體中文（transcript），再判斷。';
  return [
    '你在台灣的店家櫃檯，幫一位聽障顧客判斷店員剛剛問了什麼。',
    input,
    `這間店常問的問題（id：問題）：\n${list}`,
    '只有很確定店員是在問其中一題時，card_id 才填那一題的 id；不是在問問題、聽不清楚、或都不像，就填 none。不要猜。',
  ].join('\n\n');
}

export function geminiBody(req: UnderstandRequest, cards: Card[]): object {
  const prompt = { text: buildPrompt(cards, req.text) };
  const parts = req.audio ? [{ inlineData: { mimeType: req.audio.mime, data: req.audio.data } }, prompt] : [prompt];
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          transcript: { type: 'STRING' },
          card_id: { type: 'STRING', format: 'enum', enum: [...cards.map((c) => c.id), 'none'] },
        },
        required: ['transcript', 'card_id'],
      },
    },
  };
}

/** 模型回的 JSON → 答案。不在這間店的卡片一律當成 none。 */
export function parseAnswer(raw: string, cards: Card[]): UnderstandAnswer | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { transcript, card_id } = data as Record<string, unknown>;
  if (typeof card_id !== 'string') return null;
  return {
    transcript: typeof transcript === 'string' ? transcript.trim() : '',
    cardId: cards.some((c) => c.id === card_id) ? card_id : null,
  };
}

/** 規則優先：叫號、金額、用藥、字面或發音命中都不給模型改。只有「不確定」才換成模型選的卡。 */
export function fuse(rule: ClassifyResult, cardId: string | null, cards: Card[]): ClassifyResult {
  if (rule.kind !== 'unknown' || !cardId) return rule;
  const card = cards.find((c) => c.id === cardId);
  return card ? { kind: 'card', card, keyword: '', byModel: true } : rule;
}
