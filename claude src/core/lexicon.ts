// 規則判斷共用的詞表。

/** 出現這些詞，句子裡的數字多半是金額。 */
export const MONEY_WORDS = ['塊錢', '總共', '一共', '收你', '算你', '算妳', '金額', '元', '塊', '錢', '共'];

/** 數字後面接這些字，是數量不是金額。 */
export const QUANTITY_UNITS = '斤兩杯個份次天顆包點位樓件瓶罐盒碗粒號';

/** 數字後面接這些字，就不是叫號。 */
export const COUNT_UNITS = '元塊錢' + QUANTITY_UNITS.replace('號', '');

/** 藥局的用法用量用語。 */
export const DOSAGE_WORDS = /一天|每天|每日|飯前|飯後|睡前|小時|幾次|顆|包|天份|早晚/;

export function findMoneyWords(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  for (const w of MONEY_WORDS) {
    for (let i = text.indexOf(w); i !== -1; i = text.indexOf(w, i + 1)) {
      if (!spans.some((s) => i < s.end && i + w.length > s.start)) spans.push({ start: i, end: i + w.length });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

/** 數字之後第一個非空白字元。 */
export function charAfter(text: string, end: number): string {
  return text.slice(end).trimStart().charAt(0);
}

/** 數字之前的文字（去掉尾端空白）。 */
export function textBefore(text: string, start: number): string {
  return text.slice(0, start).trimEnd();
}
