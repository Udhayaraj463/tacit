import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from './session-log';

const KEY = 'vd.sessions';
const MAX_SESSIONS = 100;

export async function loadSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

export async function saveSession(session: Session): Promise<void> {
  if (!session.events.length) return;
  const all = (await loadSessions()).filter((s) => s.id !== session.id);
  const next = [session, ...all].slice(0, MAX_SESSIONS);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export async function clearSessions(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
