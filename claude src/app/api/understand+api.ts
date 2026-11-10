// 雲端判斷的伺服器端（EAS Hosting）。Gemini 的 key 只在這裡，App 拿不到。
// 不記錄、不保存店員的話或錄音；失敗時只回錯誤代碼，App 會退回「不確定」。
import { BUILTIN_CARDS, STORES, cardsForStore } from '../../core/cards';
import { checkRequest, geminiBody, parseAnswer } from '../../core/understand';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const STORE_IDS = STORES.map((s) => s.id);

/** 給自己檢查用：有沒有設定 key（不會透露 key 本身） */
export function GET() {
  return Response.json({ configured: !!process.env.GEMINI_API_KEY, model: MODEL });
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'not-configured' }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'body' }, { status: 400 });
  }
  const checked = checkRequest(body, STORE_IDS);
  if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });

  const cards = cardsForStore(BUILTIN_CARDS, checked.req.store);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(geminiBody(checked.req, cards)),
    });
  } catch {
    return Response.json({ error: 'upstream' }, { status: 502 });
  }
  if (!res.ok) {
    // 只回狀態碼與 Google 的錯誤說明（不含 key），方便排查設定問題
    const detail = await res.text().catch(() => '');
    return Response.json({ error: 'upstream', status: res.status, detail: detail.slice(0, 300) }, { status: 502 });
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const answer = parseAnswer(text, cards);
  if (!answer) return Response.json({ error: 'parse' }, { status: 502 });
  return Response.json(answer);
}
