// 唸出來、觸覺回饋、叫號震動。網頁上沒有觸覺回饋就略過。
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Platform, Vibration } from 'react-native';
import type { Haptics as HapticLevel } from '../state/settings';

/** 唸出來。onDone 在唸完、被打斷或失敗時都會呼叫（用來恢復收音）。 */
export function speak(text: string, onDone?: () => void) {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, { language: 'zh-TW', rate: 0.95, onDone, onStopped: onDone, onError: onDone });
}

export function tap(level: HapticLevel) {
  if (level === 'off' || Platform.OS === 'web') return;
  Haptics.impactAsync(level === 'strong' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** 叫號：長震動。使用者關掉震動時仍保留全螢幕閃爍提示。 */
export function buzzCall(level: HapticLevel) {
  if (level === 'off') return;
  Vibration.vibrate(level === 'strong' ? [0, 600, 150, 600, 150, 1000] : [0, 400, 120, 400]);
}
