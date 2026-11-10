const pad = (n: number) => String(n).padStart(2, '0');

/** 「今天 18:20」「昨天 09:05」「10 月 21 日 12:40」 */
export function formatWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `今天 ${time}`;
  if (sameDay(d, yesterday)) return `昨天 ${time}`;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${time}`;
}

/** 依時間打招呼 */
export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 11 ? '早安' : h < 18 ? '午安' : '晚安';
}
