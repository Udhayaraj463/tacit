// 設定升級：預設值改了，但手機上已經存了舊的值時，在這裡一次性改過來。
/** 2：預設改回「平放」雙面畫面（2026-10-28，使用者決定） */
export const SETTINGS_VERSION = 2;

type Versioned = { v?: number; holdMode?: 'hand' | 'flat' };

export function migrateSettings<T extends object>(saved: Partial<T> & Versioned, defaults: T): T & { v: number } {
  const next = { ...defaults, ...saved } as T & Versioned;
  if ((saved.v ?? 1) < 2) next.holdMode = 'flat';
  return { ...next, v: SETTINGS_VERSION } as T & { v: number };
}
