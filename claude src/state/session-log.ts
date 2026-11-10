// 對話紀錄（SPEC §9.3）。一次櫃檯模式 = 一個 session。這裡只放純邏輯，存取在 records-store.ts。

export type SessionEvent =
  | { t: number; type: 'heard'; text: string; conf?: number }
  | { t: number; type: 'card'; id: string; question: string; by: 'rule' | 'manual' | 'clerk' | 'model' }
  | { t: number; type: 'answer'; text: string }
  | { t: number; type: 'amount'; value: number; perJin: boolean }
  | { t: number; type: 'amountConfirm'; ok: boolean; value: number }
  | { t: number; type: 'typed'; text: string }
  | { t: number; type: 'dosage'; text: string }
  | { t: number; type: 'dosageSaved' }
  | { t: number; type: 'again'; how?: 'repeat' | 'point' | 'rephrase' | 'write' }
  | { t: number; type: 'call' }
  | { t: number; type: 'unknown'; text: string }
  /** 使用者按「判斷錯了」：手機聽到什麼、判斷成什麼（卡片 id 或 unknown）、其實是哪張卡（null = 不在列表） */
  | { t: number; type: 'misheard'; heard: string; got: string; actual: string | null };

export type Session = { id: string; store: string; events: SessionEvent[] };

export type SessionSummary = {
  qa: { q: string; a: string }[];
  amounts: { value: number; perJin: boolean; confirmed?: boolean }[];
  typed: string[];
};

export function summarize(session: Session): SessionSummary {
  const out: SessionSummary = { qa: [], amounts: [], typed: [] };
  let question: string | null = null;
  for (const e of session.events) {
    if (e.type === 'card') question = e.question;
    else if (e.type === 'answer' && question) out.qa.push({ q: question, a: e.text });
    else if (e.type === 'amount') out.amounts.push({ value: e.value, perJin: e.perJin });
    else if (e.type === 'amountConfirm' && out.amounts.length) {
      const last = out.amounts[out.amounts.length - 1];
      last.value = e.value;
      last.confirmed = e.ok;
    } else if (e.type === 'typed') out.typed.push(e.text);
  }
  return out;
}

/** 所有存下來的用法用量，新的在前。 */
export function allDosages(sessions: Session[]): { text: string; sessionId: string }[] {
  const out: { text: string; sessionId: string }[] = [];
  const newestFirst = [...sessions].sort((a, b) => b.id.localeCompare(a.id));
  for (const s of newestFirst) {
    const saved: string[] = [];
    let pending: string | null = null;
    for (const e of s.events) {
      if (e.type === 'dosage') pending = e.text;
      else if (e.type === 'dosageSaved' && pending) {
        saved.push(pending);
        pending = null;
      }
    }
    out.push(...saved.reverse().map((text) => ({ text, sessionId: s.id })));
  }
  return out;
}

/** 還沒加上時間戳的事件（記錄時由 logger 補上 t）。 */
export type NewEvent = SessionEvent extends infer E ? (E extends SessionEvent ? Omit<E, 't'> : never) : never;

/** 首頁「最近」那一行：「少冰、半糖・NT$ 65」 */
export function recentLine(session: Session): string {
  const sum = summarize(session);
  const answers = sum.qa.map((x) => x.a);
  const parts: string[] = [];
  if (answers.length) parts.push(answers.length > 3 ? `${answers.slice(0, 3).join('、')} 等 ${answers.length} 項` : answers.join('、'));
  const paid = [...sum.amounts].reverse().find((a) => a.confirmed);
  if (paid) parts.push(`NT$ ${paid.value.toLocaleString('zh-TW')}`);
  if (!parts.length && sum.typed.length) parts.push(`打字 ${sum.typed.length} 次`);
  return parts.length ? parts.join('・') : '沒有回答任何問題';
}

/** 匯出給開發者的辨識錯誤紀錄。長串數字（電話等）遮掉。 */
export function misheardReport(sessions: Session[]): { count: number; text: string } {
  const mask = (t: string) => t.replace(/\d{6,}/g, '***');
  const lines: string[] = [];
  for (const s of sessions) {
    for (const e of s.events) {
      if (e.type !== 'misheard') continue;
      lines.push(`${s.id.slice(0, 16).replace('T', ' ')}\t${s.store}\t「${mask(e.heard)}」\t${e.got} → ${e.actual ?? '（不在問題列表）'}`);
    }
  }
  if (!lines.length) return { count: 0, text: '' };
  return { count: lines.length, text: ['看得見的對話・辨識錯誤紀錄', '時間\t情境\t手機聽到\t判斷 → 其實', ...lines].join('\n') };
}
