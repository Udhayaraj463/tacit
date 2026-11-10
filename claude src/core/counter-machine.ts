// 櫃檯模式狀態機（SPEC §4）。使用者面（screen）與店員面（clerk）分開記，
// 因為「再說一次」只改店員面、使用者面的卡片要保留。

import { CLERK } from '../i18n/zh-TW';
import type { ClassifyResult } from './classify';
import type { Card, CardOption } from './types';

export type Screen =
  | { type: 'idle' }
  | { type: 'card'; card: Card; chosen?: CardOption }
  | { type: 'amount'; amount: number; perJin: boolean; candidates?: number[]; confirmed?: boolean }
  | { type: 'dosage'; text: string; saved: boolean }
  | { type: 'unknown'; text: string };

/** 聽不懂時請店員怎麼做 */
export type AgainHow = 'repeat' | 'point' | 'rephrase' | 'write';

export type Clerk =
  | { type: 'intro' }
  | { type: 'question'; question: string }
  | { type: 'answer'; show: string; question: string; tts?: string }
  | { type: 'again'; how: AgainHow }
  | { type: 'amount'; amount: number; perJin: boolean }
  | { type: 'amountOk'; amount: number; perJin: boolean }
  | { type: 'amountNo' }
  | { type: 'typed'; text: string }
  | { type: 'dosage'; text: string };

export type CounterState = {
  screen: Screen;
  clerk: Clerk;
  /** 店員說的原句，只給使用者看 */
  heard: string;
  callAlert: boolean;
  /** 走過的畫面，按「返回」退一步 */
  history: Screen[];
};

export type CounterAction =
  | { type: 'heard'; text: string; result: ClassifyResult }
  | { type: 'pickCard'; card: Card }
  | { type: 'answer'; option: CardOption; next?: Card }
  | { type: 'again'; how?: AgainHow }
  | { type: 'amountConfirm'; ok: boolean; value?: number }
  | { type: 'typed'; text: string }
  | { type: 'dosageSaved' }
  | { type: 'done' }
  | { type: 'back' }
  | { type: 'dismissCall' };

export const initialCounter: CounterState = {
  screen: { type: 'idle' },
  clerk: { type: 'intro' },
  heard: '',
  callAlert: false,
  history: [],
};

const MAX_HISTORY = 10;

/** 換到新畫面，把目前的畫面記下來（列表本身不用記，退到底就是列表）。 */
const go = (s: CounterState, screen: Screen, clerk: Clerk): CounterState => ({
  ...s,
  screen,
  clerk,
  history: s.screen.type === 'idle' ? s.history : [...s.history, s.screen].slice(-MAX_HISTORY),
});

const showCard = (s: CounterState, card: Card): CounterState =>
  go(s, { type: 'card', card }, { type: 'question', question: card.question });

/** 退回某個畫面時，店員面要顯示的內容 */
function clerkFor(screen: Screen): Clerk {
  switch (screen.type) {
    case 'card':
      return screen.chosen
        ? { type: 'answer', show: screen.chosen.show, question: screen.card.question }
        : { type: 'question', question: screen.card.question };
    case 'amount':
      if (screen.confirmed === true) return { type: 'amountOk', amount: screen.amount, perJin: screen.perJin };
      if (screen.confirmed === false) return { type: 'amountNo' };
      return { type: 'amount', amount: screen.amount, perJin: screen.perJin };
    case 'dosage':
      return { type: 'dosage', text: screen.text };
    default:
      return { type: 'intro' };
  }
}

function applyResult(s: CounterState, r: ClassifyResult): CounterState {
  switch (r.kind) {
    case 'call':
      return { ...s, callAlert: true };
    case 'card':
      return showCard(s, r.card);
    case 'amount': {
      const { amount, perJin, candidates } = r;
      return go(s, { type: 'amount', amount, perJin, ...(candidates && { candidates }) }, { type: 'amount', amount, perJin });
    }
    case 'dosage':
      return go(s, { type: 'dosage', text: r.text, saved: false }, { type: 'dosage', text: r.text });
    case 'unknown':
      // 店員面不變：不顯示沒把握的原句
      return go(s, { type: 'unknown', text: r.text }, s.clerk);
  }
}

export function counterReducer(s: CounterState, a: CounterAction): CounterState {
  switch (a.type) {
    case 'heard':
      return applyResult(a.result.kind === 'call' ? s : { ...s, heard: a.text }, a.result);
    case 'pickCard':
      return showCard(s, a.card);
    case 'answer': {
      if (a.option.kind === 'type' || s.screen.type !== 'card') return s;
      const { card } = s.screen;
      const clerk: Clerk = { type: 'answer', show: a.option.show, question: card.question, tts: a.option.tts };
      if (!a.next) return { ...s, screen: { type: 'card', card, chosen: a.option }, clerk };
      // 接著問下一張：記下「已回答」的這張，返回時看得到剛剛選了什麼
      return go({ ...s, screen: { type: 'card', card, chosen: a.option } }, { type: 'card', card: a.next }, clerk);
    }
    case 'again':
      return { ...s, clerk: { type: 'again', how: a.how ?? 'repeat' } };
    case 'amountConfirm': {
      if (s.screen.type !== 'amount') return s;
      const amount = a.value ?? s.screen.amount;
      const { perJin } = s.screen;
      return {
        ...s,
        screen: { ...s.screen, amount, confirmed: a.ok },
        clerk: a.ok ? { type: 'amountOk', amount, perJin } : { type: 'amountNo' },
      };
    }
    case 'typed':
      return { ...s, clerk: { type: 'typed', text: a.text } };
    case 'dosageSaved':
      return s.screen.type === 'dosage' ? { ...s, screen: { ...s.screen, saved: true } } : s;
    case 'done':
      return initialCounter;
    case 'back': {
      if (s.screen.type === 'idle') return s;
      const prev = s.history[s.history.length - 1];
      if (!prev) return { ...s, screen: { type: 'idle' }, clerk: { type: 'intro' }, heard: '', history: [] };
      return { ...s, screen: prev, clerk: clerkFor(prev), heard: '', history: s.history.slice(0, -1) };
    }
    case 'dismissCall':
      return { ...s, callAlert: false };
  }
}

export type ClerkView = { label: string; main: string; sub: string; big?: boolean; accent?: boolean; subAccent?: boolean };

export function clerkView(s: CounterState, intro: string): ClerkView {
  const c = s.clerk;
  switch (c.type) {
    case 'intro':
      return { label: CLERK.idleLabel, main: intro, sub: CLERK.idleSub };
    case 'question':
      return { label: CLERK.questionLabel, main: c.question, sub: CLERK.questionSub };
    case 'answer':
      return { label: CLERK.answerLabel, main: c.show, sub: c.question, subAccent: true };
    case 'again':
      return { label: CLERK.againLabel, ...CLERK.again[c.how], accent: true };
    case 'amount':
      return { label: CLERK.amountLabel, main: (c.perJin ? CLERK.perJin : CLERK.yuan)(c.amount), sub: CLERK.amountSub, big: true };
    case 'amountOk':
      return { label: CLERK.amountOkLabel, main: `${(c.perJin ? CLERK.perJin : CLERK.yuan)(c.amount)} ✓`, sub: CLERK.amountOkSub, big: true };
    case 'amountNo':
      return { label: CLERK.amountNoLabel, main: CLERK.amountNoMain, sub: CLERK.amountNoSub, accent: true };
    case 'typed':
      return { label: CLERK.typedLabel, main: c.text, sub: '' };
    case 'dosage':
      return { label: CLERK.dosageLabel, main: c.text, sub: CLERK.dosageSub };
  }
}

/**
 * 店員面現在這一句要怎麼唸出來（給不識字、或看不清楚字的人用）。
 * 回答用卡片上準備好的唸法；其他唸大字那一行，打勾符號不唸。
 */
export function clerkSpeech(s: CounterState, intro: string): string {
  if (s.clerk.type === 'answer') return s.clerk.tts || s.clerk.show;
  return clerkView(s, intro).main.replace(/\s*✓\s*$/, '').trim();
}
