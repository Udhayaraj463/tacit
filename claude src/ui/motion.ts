// 減少動態效果：跟著系統設定，開著時所有動畫直接到終點。
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { motion } from './theme';

export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** key 改變時淡入並往上滑 8px（新卡片出現時用）。 */
export function useEnter(key: string) {
  const reduce = useReducedMotion();
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduce) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: motion.enter, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [key, reduce, v]);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
}
