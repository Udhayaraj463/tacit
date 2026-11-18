// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Image,
  TextInput,
  Platform,
  Alert,
  Vibration,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ☁️ RENDER CLOUD SYNC ENDPOINT
const CLOUD_SYNC_URL = 'https://tacit-77cd.onrender.com/api/sync';

// 🛡️ Platform-Guarded Native Speech Loader
let NativeSpeechModule: any = null;
let nativeSpeechPkg: any = null;

if (Platform.OS !== 'web') {
  try {
    nativeSpeechPkg = require('expo-speech-recognition');
    NativeSpeechModule = nativeSpeechPkg.ExpoSpeechRecognitionModule || nativeSpeechPkg.default;
  } catch (err) {
    console.warn('Native speech recognition module skipped on this platform:', err);
  }
}

const attachNativeSpeechEvent = (eventName: string, callback: (event: any) => void) => {
  if (!NativeSpeechModule) return null;
  try {
    if (typeof NativeSpeechModule.addListener === 'function') {
      return NativeSpeechModule.addListener(eventName, callback);
    }
    if (typeof nativeSpeechPkg?.addSpeechRecognitionListener === 'function') {
      return nativeSpeechPkg.addSpeechRecognitionListener(eventName, callback);
    }
  } catch (e) {}
  return null;
};

// 🎨 PINTEREST WEATHER-UI INSPIRED DAY & NIGHT ATMOSPHERIC PALETTES
const THEMES = {
  dark: {
    bg: '#0B1026',
    surface: 'rgba(23, 31, 66, 0.78)',
    surfaceSolid: '#151D3D',
    surfaceLight: 'rgba(38, 50, 98, 0.85)',
    text: '#F8FAFF',
    textMuted: '#9BA8D2',
    orange: '#FF9F1C',
    danger: '#FF4D6D',
    success: '#2EC4B6',
    translateAccent: '#4CC9F0',
    border: 'rgba(165, 185, 255, 0.16)',
    clerkBg: '#080B1A',
    clerkCard: '#151D3D',
  },
  light: {
    bg: '#E3F0FF',
    surface: 'rgba(255, 255, 255, 0.84)',
    surfaceSolid: '#FFFFFF',
    surfaceLight: 'rgba(214, 232, 255, 0.92)',
    text: '#10213A',
    textMuted: '#5B7499',
    orange: '#FF8C00',
    danger: '#E63946',
    success: '#10B981',
    translateAccent: '#0077B6',
    border: 'rgba(255, 255, 255, 0.85)',
    clerkBg: '#0E172B',
    clerkCard: '#1B2845',
  },
};

const FONT_FAMILY = Platform.OS === 'web' ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : undefined;

export type SupportedLang = 'en-US' | 'zh-TW';

const STORAGE_KEYS = {
  VENUES: 'mochi_custom_venues_v6',
  CARDS: 'mochi_custom_cards_v6',
  WALLPAPERS: 'mochi_wallpapers_v6',
  FONT_SCALE: 'mochi_font_scale_v6',
  THEME_MODE: 'mochi_theme_mode_v6',
  CARRIER_CODE: 'mochi_carrier_code_v6',
};

// ============================================================================
// 🌤️🌙 PINTEREST WEATHER-APP DAY & NIGHT SKY BACKGROUND ANIMATION
// ============================================================================
const STAR_POSITIONS = [
  { top: '7%', left: '15%', size: 3 },
  { top: '12%', left: '78%', size: 4 },
  { top: '19%', left: '42%', size: 2.5 },
  { top: '26%', left: '88%', size: 3.5 },
  { top: '34%', left: '12%', size: 2.5 },
  { top: '48%', left: '68%', size: 3 },
  { top: '62%', left: '22%', size: 3.5 },
  { top: '75%', left: '84%', size: 2.5 },
];

const AmbientBackground = ({
  themeMode,
  isListening,
  isCounter,
}: {
  themeMode: 'dark' | 'light';
  isListening?: boolean;
  isCounter?: boolean;
}) => {
  const drift1 = useRef(new Animated.Value(0)).current;
  const drift2 = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'mochi-gpu-sky-animations';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          @keyframes mochiFloatSlow {
            0%, 100% { transform: translate3d(-30px, -18px, 0) scale(1); }
            50% { transform: translate3d(42px, 26px, 0) scale(1.12); }
          }
          @keyframes mochiFloatReverse {
            0%, 100% { transform: translate3d(36px, 22px, 0) scale(1.08); }
            50% { transform: translate3d(-38px, -24px, 0) scale(0.92); }
          }
          @keyframes mochiCloudDrift {
            0%, 100% { transform: translate3d(-18px, 0px, 0); }
            50% { transform: translate3d(28px, -8px, 0); }
          }
          @keyframes mochiTwinkle {
            0%, 100% { opacity: 0.22; transform: scale(0.85); }
            50% { opacity: 0.95; transform: scale(1.2); }
          }
        `;
        document.head.appendChild(style);
      }
      return;
    }

    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(drift1, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift1, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(drift2, { toValue: 1, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift2, { toValue: 0, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const loop3 = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 0.95, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0.25, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop1.start();
    loop2.start();
    loop3.start();
    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [drift1, drift2, twinkle]);

  const tx1 = drift1.interpolate({ inputRange: [0, 1], outputRange: [-32, 42] });
  const ty1 = drift1.interpolate({ inputRange: [0, 1], outputRange: [-18, 26] });
  const tx2 = drift2.interpolate({ inputRange: [0, 1], outputRange: [36, -36] });
  const ty2 = drift2.interpolate({ inputRange: [0, 1], outputRange: [22, -22] });

  const isDark = themeMode === 'dark';
  const isWeb = Platform.OS === 'web';

  const orb1AnimStyle = isWeb ? ({ animation: 'mochiFloatSlow 14s ease-in-out infinite', willChange: 'transform' } as any) : { transform: [{ translateX: tx1 }, { translateY: ty1 }] };
  const orb2AnimStyle = isWeb ? ({ animation: 'mochiFloatReverse 18s ease-in-out infinite', willChange: 'transform' } as any) : { transform: [{ translateX: tx2 }, { translateY: ty2 }] };
  const cloudAnimStyle = isWeb ? ({ animation: 'mochiCloudDrift 11s ease-in-out infinite', willChange: 'transform' } as any) : { transform: [{ translateX: tx1 }] };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {isDark ? (
        <>
          <Animated.View style={[styles.auroraOrb, { width: 320, height: 320, borderRadius: 160, top: isCounter ? '44%' : -60, right: -70, backgroundColor: isListening ? '#2EC4B6' : '#4361EE', opacity: 0.26 }, orb1AnimStyle]} />
          <Animated.View style={[styles.auroraOrb, { width: 280, height: 280, borderRadius: 140, bottom: -60, left: -70, backgroundColor: '#7209B7', opacity: 0.22 }, orb2AnimStyle]} />
          {!isCounter && (
            <Animated.View style={[{ position: 'absolute', top: 48, right: 28, opacity: 0.26 }, cloudAnimStyle]}>
              <Ionicons name="moon" size={64} color="#FFD166" />
            </Animated.View>
          )}
          {STAR_POSITIONS.map((star, idx) => (
            <Animated.View key={idx} style={[{ position: 'absolute', top: star.top, left: star.left, width: star.size, height: star.size, borderRadius: star.size / 2, backgroundColor: '#FFFFFF' }, isWeb ? ({ animation: `mochiTwinkle ${2.8 + (idx % 3) * 0.9}s ease-in-out infinite` } as any) : { opacity: twinkle }]} />
          ))}
        </>
      ) : (
        <>
          <Animated.View style={[styles.auroraOrb, { width: 300, height: 300, borderRadius: 150, top: isCounter ? '42%' : -75, right: -55, backgroundColor: '#FFD166', opacity: 0.48 }, orb1AnimStyle]} />
          <Animated.View style={[styles.auroraOrb, { width: 340, height: 340, borderRadius: 170, bottom: -80, left: -70, backgroundColor: '#90E0EF', opacity: 0.45 }, orb2AnimStyle]} />
          {!isCounter && (
            <>
              <Animated.View style={[{ position: 'absolute', top: 42, right: 26, opacity: 0.38 }, cloudAnimStyle]}>
                <Ionicons name="partly-sunny" size={72} color="#FF9F1C" />
              </Animated.View>
              <Animated.View style={[{ position: 'absolute', top: 110, left: 24, opacity: 0.45 }, orb2AnimStyle]}>
                <Ionicons name="cloud" size={54} color="#FFFFFF" />
              </Animated.View>
            </>
          )}
        </>
      )}
    </View>
  );
};

// ============================================================================
// 🌞🌚 PINTEREST-STYLE ANIMATED DAY / NIGHT SCENERY PILL SWITCH
// ============================================================================
const DayNightScenerySwitch = ({ themeMode, onToggle }: { themeMode: 'dark' | 'light'; onToggle: () => void }) => {
  const isDark = themeMode === 'dark';
  const slideAnim = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: isDark ? 1 : 0, friction: 7, tension: 50, useNativeDriver: true }).start();
  }, [isDark, slideAnim]);

  const thumbTranslateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 78] });

  return (
    <Pressable onPress={onToggle} accessibilityRole="switch" accessibilityState={{ checked: isDark }}>
      <View style={[styles.scenerySwitchTrack, { backgroundColor: isDark ? '#121836' : '#72B6FF', borderColor: isDark ? 'rgba(165, 185, 255, 0.3)' : 'rgba(255, 255, 255, 0.8)' }]}>
        {isDark ? (
          <View style={styles.sceneryTrackDecorLeft}>
            <Ionicons name="sparkles" size={14} color="#FFD166" />
            <Text style={styles.sceneryTrackLabelDark}>NIGHT</Text>
          </View>
        ) : (
          <View style={styles.sceneryTrackDecorRight}>
            <Text style={styles.sceneryTrackLabelLight}>DAY</Text>
            <Ionicons name="cloud" size={18} color="#FFFFFF" />
          </View>
        )}
        <Animated.View style={[styles.scenerySwitchThumb, { backgroundColor: isDark ? '#253166' : '#FFE066', shadowColor: isDark ? '#000' : '#FF9F1C', transform: [{ translateX: thumbTranslateX }] }]}>
          {isDark ? <Ionicons name="moon" size={22} color="#FFD166" /> : <Ionicons name="sunny" size={24} color="#FF8800" />}
        </Animated.View>
      </View>
    </Pressable>
  );
};

// ============================================================================
// 🎙️ LIVE ANIMATED SOUNDWAVE EQUALIZER BARS
// ============================================================================
const LiveAudioWave = ({ active, color = '#2EC4B6' }: { active: boolean; color?: string }) => {
  const b1 = useRef(new Animated.Value(0.3)).current;
  const b2 = useRef(new Animated.Value(0.5)).current;
  const b3 = useRef(new Animated.Value(0.8)).current;
  const b4 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!active) {
      b1.setValue(0.3); b2.setValue(0.3); b3.setValue(0.3); b4.setValue(0.3);
      return;
    }
    const makeBarLoop = (val: Animated.Value, d: number) => Animated.loop(Animated.sequence([Animated.timing(val, { toValue: 1, duration: d, useNativeDriver: true }), Animated.timing(val, { toValue: 0.25, duration: d, useNativeDriver: true })]));
    const l1 = makeBarLoop(b1, 320); const l2 = makeBarLoop(b2, 240); const l3 = makeBarLoop(b3, 390); const l4 = makeBarLoop(b4, 280);
    l1.start(); l2.start(); l3.start(); l4.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); l4.stop(); };
  }, [active, b1, b2, b3, b4]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 16 }}>
      {[b1, b2, b3, b4].map((bar, i) => (
        <Animated.View key={i} style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: active ? color : '#8E8E93', transform: [{ scaleY: bar }] }} />
      ))}
    </View>
  );
};

export const LANGUAGE_LIST = [
  { code: 'zh-TW', name: '繁體中文 (Traditional Chinese)', short: '中文' },
  { code: 'en-US', name: 'English (US)', short: 'English' },
];

export const FONT_SCALE_OPTIONS = [
  { label: '小 (85%)', short: 'A-', val: 0.85 },
  { label: '標準 (100%)', short: 'A', val: 1.0 },
  { label: '中大 (115%)', short: 'A+', val: 1.15 },
  { label: '大 (130%)', short: 'A++', val: 1.3 },
  { label: '特大 (150%)', short: 'MAX', val: 1.5 },
];

export const VENUE_TEMPLATES = [
  { id: 'cvs', label: '🏪 超商', enLabel: '🏪 CVS', emoji: '🏪', coverImage: 'https://images.unsplash.com/photo-1601599561096-f87c95fff1e9?w=1200' },
  { id: 'drink', label: '🧋 咖啡飲料', enLabel: '🧋 Cafe', emoji: '🧋', coverImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200' },
  { id: 'breakfast', label: '🥪 早餐店', enLabel: '🥪 Breakfast', emoji: '🥪', coverImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1200' },
  { id: 'pharmacy', label: '💊 藥局診所', enLabel: '💊 Pharmacy', emoji: '💊', coverImage: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200' },
  { id: 'buffet', label: '🍱 便當餐廳', enLabel: '🍱 Dining', emoji: '🍱', coverImage: 'https://images.unsplash.com/photo-1548943487-a2e4b43b5930?w=1200' },
  { id: 'university', label: '🏫 校園圖書館', enLabel: '🏫 Campus', emoji: '🏫', coverImage: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200' },
  { id: 'other', label: '🏬 一般場所', enLabel: '🏬 General', emoji: '🏬', coverImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200' },
];

const DEFAULT_STORES_DATA = [
  { id: 'cvs', baseType: 'cvs', name: { 'zh-TW': '便利商店', 'en-US': 'Convenience Store' }, short: { 'zh-TW': '便利商店', 'en-US': '7-Eleven / CVS' }, emoji: '🏪', coverImage: 'https://images.unsplash.com/photo-1601599561096-f87c95fff1e9?w=1200' },
  { id: 'drink', baseType: 'drink', name: { 'zh-TW': '咖啡・飲料店', 'en-US': 'Cafe & Drinks' }, short: { 'zh-TW': '咖啡飲料', 'en-US': 'Cafe' }, emoji: '🧋', coverImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200' },
  { id: 'breakfast', baseType: 'breakfast', name: { 'zh-TW': '早餐店', 'en-US': 'Breakfast Shop' }, short: { 'zh-TW': '早餐店', 'en-US': 'Breakfast' }, emoji: '🥪', coverImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1200' },
  { id: 'pharmacy', baseType: 'pharmacy', name: { 'zh-TW': '藥局・診所', 'en-US': 'Pharmacy & Clinic' }, short: { 'zh-TW': '藥局診所', 'en-US': 'Pharmacy' }, emoji: '💊', coverImage: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200' },
  { id: 'buffet', baseType: 'buffet', name: { 'zh-TW': '自助餐・便當', 'en-US': 'Bento & Buffet' }, short: { 'zh-TW': '自助餐便當', 'en-US': 'Buffet' }, emoji: '🍱', coverImage: 'https://images.unsplash.com/photo-1548943487-a2e4b43b5930?w=1200' },
];

const sanitizeCardsList = (list: any[]) => {
  if (!Array.isArray(list)) return list;
  return list.map((card) => ({
    ...card,
    options: Array.isArray(card.options)
      ? card.options.map((opt: any) => {
          const rawLabel = opt?.labels?.['zh-TW'] || '';
          const cleanTts = (opt?.tts || rawLabel).replace(/，?謝謝/g, '').trim();
          return {
            ...opt,
            tts: card.isCustom ? cleanTts : (rawLabel || cleanTts),
          };
        })
      : [],
  }));
};

const DEFAULT_CARDS_DATA = [
  { id: 'temp_choice', stores: ['drink', 'cvs', 'breakfast'], priority: 1, question: { 'zh-TW': '冰的還是熱的？', 'en-US': 'Iced or Hot?' }, keywords: ['冰的', '熱的', '溫的', '冰塊', 'iced', 'hot', 'warm'], options: [{ labels: { 'zh-TW': '冰的', 'en-US': 'Iced' }, subLabels: { 'zh-TW': '冷飲', 'en-US': 'Cold drink' }, tts: '冰的' }, { labels: { 'zh-TW': '熱的', 'en-US': 'Hot' }, subLabels: { 'zh-TW': '熱飲', 'en-US': 'Hot drink' }, tts: '熱的' }, { labels: { 'zh-TW': '溫的', 'en-US': 'Warm' }, subLabels: { 'zh-TW': '溫飲', 'en-US': 'Warm drink' }, tts: '溫的' }] },
  { id: 'icelevel', stores: ['drink'], priority: 1, question: { 'zh-TW': '冰塊要多少？', 'en-US': 'How much ice?' }, keywords: ['冰塊', '正常冰', '少冰', '微冰', '去冰', '完全去冰', 'ice'], options: [{ labels: { 'zh-TW': '正常冰', 'en-US': 'Regular Ice' }, subLabels: { 'zh-TW': '標準冰量', 'en-US': 'Normal ice' }, tts: '正常冰' }, { labels: { 'zh-TW': '少冰', 'en-US': 'Less Ice' }, subLabels: { 'zh-TW': '7分冰', 'en-US': '70% ice' }, tts: '少冰' }, { labels: { 'zh-TW': '微冰', 'en-US': 'Light Ice' }, subLabels: { 'zh-TW': '3分冰', 'en-US': '30% ice' }, tts: '微冰' }, { labels: { 'zh-TW': '去冰', 'en-US': 'No Ice' }, subLabels: { 'zh-TW': '不要冰塊', 'en-US': 'Zero ice' }, tts: '去冰' }] },
  { id: 'sugar', stores: ['drink'], priority: 1, question: { 'zh-TW': '甜度？', 'en-US': 'Sweetness level?' }, keywords: ['糖', '甜度', '甜', '半糖', '微糖', '無糖', '少糖', '全糖', 'sugar', 'sweet'], options: [{ labels: { 'zh-TW': '無糖', 'en-US': 'No Sugar' }, subLabels: { 'zh-TW': '0% 甜度', 'en-US': '0% sugar' }, tts: '無糖' }, { labels: { 'zh-TW': '微糖', 'en-US': 'Light Sugar' }, subLabels: { 'zh-TW': '3分甜', 'en-US': '30% sugar' }, tts: '微糖' }, { labels: { 'zh-TW': '半糖', 'en-US': 'Half Sugar' }, subLabels: { 'zh-TW': '5分甜', 'en-US': '50% sugar' }, tts: '半糖' }, { labels: { 'zh-TW': '正常甜', 'en-US': 'Regular Sugar' }, subLabels: { 'zh-TW': '標準甜度', 'en-US': '100% sugar' }, tts: '正常甜' }] },
  { id: 'cup_size', stores: ['drink', 'cvs', 'breakfast'], priority: 1, question: { 'zh-TW': '大杯還是中杯？', 'en-US': 'Large or Medium cup?' }, keywords: ['大杯', '中杯', '小杯', '特大杯', '尺寸', 'size', 'large', 'medium'], options: [{ labels: { 'zh-TW': '大杯', 'en-US': 'Large' }, subLabels: { 'zh-TW': '大杯容量', 'en-US': 'Large cup' }, tts: '大杯' }, { labels: { 'zh-TW': '中杯', 'en-US': 'Medium' }, subLabels: { 'zh-TW': '中杯容量', 'en-US': 'Medium cup' }, tts: '中杯' }] },
  { id: 'toppings', stores: ['drink'], priority: 1, question: { 'zh-TW': '要加料嗎？', 'en-US': 'Any toppings?' }, keywords: ['加料', '珍珠', '波霸', '椰果', '仙草', '布丁', 'topping', 'boba', 'pearl'], options: [{ labels: { 'zh-TW': '不用加料', 'en-US': 'No Toppings' }, subLabels: { 'zh-TW': '原味即可', 'en-US': 'Plain drink' }, tts: '不用加料' }, { labels: { 'zh-TW': '加珍珠', 'en-US': 'Add Boba / Pearls' }, subLabels: { 'zh-TW': '波霸/珍珠', 'en-US': 'Tapioca pearls' }, tts: '加珍珠' }, { labels: { 'zh-TW': '加椰果', 'en-US': 'Add Coconut Jelly' }, subLabels: { 'zh-TW': '椰果配料', 'en-US': 'Nata de coco' }, tts: '加椰果' }] },
  { id: 'second_cup', stores: ['drink', 'cvs'], priority: 1, question: { 'zh-TW': '第二杯半價要嗎？', 'en-US': '2nd cup half price?' }, keywords: ['第二杯', '半價', '兩杯', '優惠', '寄杯', 'second cup', 'discount'], options: [{ labels: { 'zh-TW': '不用，一杯就好', 'en-US': 'No, just one' }, subLabels: { 'zh-TW': '買一杯即可', 'en-US': 'Single cup only' }, tts: '不用' }, { labels: { 'zh-TW': '好，我要兩杯', 'en-US': 'Yes, two cups' }, subLabels: { 'zh-TW': '搭配優惠', 'en-US': 'Take the deal' }, tts: '要兩杯' }] },
  { id: 'heat', stores: ['cvs', 'breakfast'], priority: 1, question: { 'zh-TW': '要加熱嗎？', 'en-US': 'Heat it up?' }, keywords: ['加熱', '微波', '熱一下', '要熱嗎', '烤一下', 'heat', 'microwave', 'warm up'], options: [{ labels: { 'zh-TW': '要加熱', 'en-US': 'Yes, heat it up' }, subLabels: { 'zh-TW': '請幫我微波加熱', 'en-US': 'Microwave please' }, tts: '要加熱' }, { labels: { 'zh-TW': '不用加熱', 'en-US': 'No need' }, subLabels: { 'zh-TW': '直接拿走', 'en-US': 'Keep as is' }, tts: '不用加熱' }] },
  { id: 'rice', stores: ['buffet'], priority: 1, question: { 'zh-TW': '白飯要多少？', 'en-US': 'How much rice?' }, keywords: ['白飯', '飯要', '半碗', '飯量', '紫米', 'rice'], options: [{ labels: { 'zh-TW': '正常飯', 'en-US': 'Normal Rice' }, subLabels: { 'zh-TW': '標準飯量', 'en-US': 'Standard portion' }, tts: '正常飯' }, { labels: { 'zh-TW': '少飯', 'en-US': 'Less Rice' }, subLabels: { 'zh-TW': '半碗飯', 'en-US': 'Half portion' }, tts: '少飯' }, { labels: { 'zh-TW': '不要飯', 'en-US': 'No Rice' }, subLabels: { 'zh-TW': '只要菜', 'en-US': 'Dishes only' }, tts: '不要飯' }] },
  { id: 'dinein', stores: ['*'], priority: 2, question: { 'zh-TW': '內用還是外帶？', 'en-US': 'For here or to go?' }, keywords: ['內用', '外帶', '這裡吃', '帶走', 'to go', 'dine in', 'for here'], options: [{ labels: { 'zh-TW': '內用', 'en-US': 'Dine In' }, subLabels: { 'zh-TW': '在店裡吃', 'en-US': 'Eat here' }, tts: '內用' }, { labels: { 'zh-TW': '外帶', 'en-US': 'Takeout' }, subLabels: { 'zh-TW': '帶走', 'en-US': 'To go' }, tts: '外帶' }] },
  { id: 'member', stores: ['*'], priority: 2, question: { 'zh-TW': '有集點或會員嗎？', 'en-US': 'Membership or points?' }, keywords: ['會員', '集點', '電話', '號碼', '統編', 'member', 'points', 'phone'], options: [{ labels: { 'zh-TW': '沒有會員', 'en-US': 'No Membership' }, subLabels: { 'zh-TW': '不用集點', 'en-US': 'Skip points' }, tts: '沒有會員' }, { labels: { 'zh-TW': '有，掃條碼', 'en-US': 'Yes, scan barcode' }, subLabels: { 'zh-TW': '出示手機會員', 'en-US': 'Show member app' }, tts: '有會員，請幫我掃條碼', showBarcode: true }, { labels: { 'zh-TW': '我打字輸入電話', 'en-US': 'Type Phone Number' }, subLabels: { 'zh-TW': '用鍵盤顯示電話', 'en-US': 'Show phone on screen' }, tts: '請看我螢幕上的電話號碼', kind: 'type' }] },
  { id: 'carrier', stores: ['*'], priority: 2, question: { 'zh-TW': '有載具嗎？', 'en-US': 'Do you have a receipt carrier?' }, keywords: ['載具', '條碼', '手機條碼', '雲端發票', 'carrier', 'barcode'], options: [{ labels: { 'zh-TW': '手機條碼', 'en-US': 'Phone Barcode' }, subLabels: { 'zh-TW': '顯示載具條碼給店員掃', 'en-US': 'Show carrier barcode on top screen' }, tts: '有載具，請掃手機條碼', showBarcode: true }, { labels: { 'zh-TW': '紙本發票', 'en-US': 'Paper Receipt' }, subLabels: { 'zh-TW': '直接印出來', 'en-US': 'Print paper receipt' }, tts: '沒有載具，請印紙本發票' }, { labels: { 'zh-TW': '不用', 'en-US': 'No need' }, subLabels: { 'zh-TW': '不用載具', 'en-US': 'No carrier' }, tts: '不用載具' }] },
  { id: 'receipt_print', stores: ['*'], priority: 2, question: { 'zh-TW': '發票要印嗎？', 'en-US': 'Print the receipt?' }, keywords: ['發票', '要印嗎', '印發票', '明細', '統編', 'receipt', 'print'], options: [{ labels: { 'zh-TW': '要印發票', 'en-US': 'Print Receipt' }, subLabels: { 'zh-TW': '紙本發票', 'en-US': 'Yes, print it' }, tts: '發票要印' }, { labels: { 'zh-TW': '不用印，存載具', 'en-US': 'Save to Carrier' }, subLabels: { 'zh-TW': '顯示手機條碼', 'en-US': 'No print, scan barcode' }, tts: '發票不用印，請幫我存載具', showBarcode: true }, { labels: { 'zh-TW': '捐發票 / 不用', 'en-US': 'Donate / No Need' }, subLabels: { 'zh-TW': '不拿紙本發票', 'en-US': 'No paper receipt' }, tts: '發票不用印' }] },
  { id: 'bag', stores: ['*'], priority: 2, question: { 'zh-TW': '需要袋子嗎？', 'en-US': 'Do you need a bag?' }, keywords: ['袋子', '提袋', '購物袋', '塑膠袋', 'bag', 'plastic bag'], options: [{ labels: { 'zh-TW': '要袋子', 'en-US': 'Need a Bag' }, subLabels: { 'zh-TW': '加購購物袋', 'en-US': 'Buy a bag' }, tts: '要袋子' }, { labels: { 'zh-TW': '不用袋子', 'en-US': 'No Bag' }, subLabels: { 'zh-TW': '自己拿或自備袋子', 'en-US': 'I have my own' }, tts: '不用袋子' }] },
  { id: 'pay', stores: ['*'], priority: 2, question: { 'zh-TW': '請問怎麼付款？', 'en-US': 'How would you like to pay?' }, keywords: ['現金', '刷卡', '付款', '支付', '悠遊卡', 'line pay', 'apple pay', 'cash', 'card', 'pay'], options: [{ labels: { 'zh-TW': '付現', 'en-US': 'Cash' }, subLabels: { 'zh-TW': '現金付款', 'en-US': 'Pay with cash' }, tts: '付現' }, { labels: { 'zh-TW': '刷卡 / 行動支付', 'en-US': 'Card / Mobile Pay' }, subLabels: { 'zh-TW': 'Apple Pay / Line Pay', 'en-US': 'Contactless payment' }, tts: '刷卡' }, { labels: { 'zh-TW': '悠遊卡', 'en-US': 'EasyCard' }, subLabels: { 'zh-TW': '感應悠遊卡', 'en-US': 'Tap EasyCard' }, tts: '悠遊卡' }] },
];

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'] as const;
const BARCODE_WEIGHTS = [3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 3];

export const CounterConversationScreen: React.FC = () => {
  if (Platform.OS !== 'web') {
    useKeepAwake();
  }
  const insets = useSafeAreaInsets();

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const THEME = THEMES[themeMode];

  const [currentLang, setCurrentLang] = useState<SupportedLang>('zh-TW');
  const [isTranslateMode, setIsTranslateMode] = useState(false);
  const [fontScale, setFontScale] = useState(1.0);
  const [isCounterMode, setIsCounterMode] = useState(false);

  const [venues, setVenues] = useState(DEFAULT_STORES_DATA);
  const [activeVenue, setActiveVenue] = useState(DEFAULT_STORES_DATA[0]);
  const [cardsData, setCardsData] = useState(DEFAULT_CARDS_DATA);

  const [customWallpapers, setCustomWallpapers] = useState<Record<string, string>>({});
  const [wallpaperInputUrl, setWallpaperInputUrl] = useState('');
  const [carrierCode, setCarrierCode] = useState('/ABC1234');
  const [showClerkBarcode, setShowClerkBarcode] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);

  // Counter Stage States
  const [clerkMessage, setClerkMessage] = useState('');
  const [clerkLabel, setClerkLabel] = useState('');
  const [clerkSub, setClerkSub] = useState('');
  const [activePromptCard, setActivePromptCard] = useState<any>(null);
  const [chosenOption, setChosenOption] = useState<any>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);

  // Flagship States (Combo Builder & Number Watcher)
  const [comboItems, setComboItems] = useState<string[]>([]);
  const [watchNumber, setWatchNumber] = useState('');
  const [isNumberModalOpen, setIsNumberModalOpen] = useState(false);
  const [numberCalledAlert, setNumberCalledAlert] = useState(false);

  const [isClerkPickOpen, setIsClerkPickOpen] = useState(false);
  const [clerkPickView, setClerkPickView] = useState<'grid' | 'amount'>('grid');
  const [clerkDigits, setClerkDigits] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTypeToClerkOpen, setIsTypeToClerkOpen] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState('');

  const [isAddQaOpen, setIsAddQaOpen] = useState(false);
  const [newQuestionInput, setNewQuestionInput] = useState('');
  const [newAnswerInput, setNewAnswerInput] = useState('');
  const [saveToastMsg, setSaveToastMsg] = useState('');

  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [nearbyVenueFound, setNearbyVenueFound] = useState<any>(null);
  const [editablePlaceName, setEditablePlaceName] = useState('');
  const [selectedBaseType, setSelectedBaseType] = useState('cvs');
  const [detectedCandidates, setDetectedCandidates] = useState<any[]>([]);

  // Self-Healing Speech Engine States
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStreamText, setLiveStreamText] = useState('');
  const [lastHeardQuestion, setLastHeardQuestion] = useState('');
  const [smartReplies, setSmartReplies] = useState<any[]>([]);

  const webRecRef = useRef<any>(null);
  const processRecognizedRef = useRef<any>(null);
  const isLiveActiveRef = useRef(false);
  isLiveActiveRef.current = isLiveActive;
  const watchdogTimerRef = useRef<any>(null);
  const lastTranscriptTimeRef = useRef<number>(Date.now());

  const triggerHaptic = (pattern: number | number[] = 60) => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(pattern); } catch (e) {}
    }
  };

  const playAttentionChime = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const playTone = (freq: number, start: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          gain.gain.setValueAtTime(0.22, ctx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur);
        };
        playTone(659.25, 0, 0.22);
        playTone(880.0, 0.18, 0.38);
      } catch (e) {}
    } else {
      triggerHaptic([0, 70, 50, 70]);
    }
  };

  const speakSentence = (text: string, forcedLang?: string) => {
    if (!text) return;
    const cleanText = text.replace(/^[💡🔊✨\s]+/, '').trim();
    const hasChinese = /[\u4e00-\u9fa5]/.test(cleanText);
    const lang = forcedLang || (hasChinese ? 'zh-TW' : currentLang);

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(' ' + cleanText);
        u.lang = lang;
        u.rate = 0.95;
        u.onend = () => {
          if (isLiveActiveRef.current) {
            lastTranscriptTimeRef.current = Date.now();
            startFreshWebRecognizer();
          }
        };
        window.speechSynthesis.speak(u);
      }, 160);
    } else {
      Speech.stop();
      setTimeout(() => {
        Speech.speak(cleanText, {
          language: lang,
          rate: 0.95,
          onDone: () => {
            if (isLiveActiveRef.current && NativeSpeechModule) {
              try {
                const targetLocale = isTranslateMode ? (currentLang === 'en-US' ? 'zh-TW' : 'en-US') : currentLang;
                NativeSpeechModule.start({ lang: targetLocale, interimResults: true, continuous: true });
              } catch (e) {}
            }
          },
        });
      }, 150);
    }
  };

  const processRecognizedText = async (rawText: string, isFinal: boolean) => {
    if (!rawText.trim()) return;

    let translated = '';
    if (isTranslateMode) {
      setLiveStreamText(rawText + (isFinal ? '' : ' ...'));
      if (isFinal) {
        const sourceLang = currentLang === 'en-US' ? 'zh-TW' : 'en-US';
        translated = await realTranslate(rawText, sourceLang, currentLang);
        setLiveStreamText(translated);
      }
    } else {
      setLiveStreamText(rawText);
    }

    if (!rawText.includes('請開始說話') && !rawText.includes('Listening') && rawText.trim().length >= 2) {
      setLastHeardQuestion(rawText.trim());
    }

    const lowerRaw = rawText.toLowerCase();
    
    // 🔔 NUMBER WATCHER TRIGGER
    if (watchNumber && rawText.includes(watchNumber)) {
      setNumberCalledAlert(true);
      triggerHaptic([0, 150, 80, 150, 80, 200]);
    }

    const currentVenueCards = cardsData.filter((c) =>
      c.stores.includes(activeVenue.id) || (activeVenue.baseType && c.stores.includes(activeVenue.baseType)) || c.stores.includes('*')
    );

    const triggeredReplies: any[] = [];
    let matchedCard: any = null;

    currentVenueCards.forEach((card) => {
      if (card.keywords.some((kw: string) => lowerRaw.includes(kw.toLowerCase()) || (translated && translated.toLowerCase().includes(kw.toLowerCase())))) {
        if (!matchedCard) matchedCard = card;
        card.options.forEach((opt: any, idx: number) => {
          triggeredReplies.push({
            id: `${card.id}_${idx}`,
            text: opt.labels[currentLang] || opt.labels['zh-TW'],
            clerkText: opt.tts || opt.labels['zh-TW'],
            cardRef: card,
            optRef: opt,
          });
        });
      }
    });

    if (matchedCard && isFinal) {
      triggerHaptic([0, 40, 60, 40]);
      openCardStage(matchedCard);
    }

    if (triggeredReplies.length > 0) setSmartReplies(triggeredReplies);
  };
  processRecognizedRef.current = processRecognizedText;

  // 🌐 SELF-HEALING ZERO-HANG WEB SPEECH ENGINE
  const startFreshWebRecognizer = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec || !isLiveActiveRef.current) return;

    if (webRecRef.current) {
      try {
        webRecRef.current.onresult = null; webRecRef.current.onend = null; webRecRef.current.onerror = null;
        webRecRef.current.abort();
      } catch (e) {}
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = isTranslateMode ? (currentLang === 'en-US' ? 'zh-TW' : 'en-US') : currentLang;

      rec.onresult = (event: any) => {
        lastTranscriptTimeRef.current = Date.now();
        let latestInterim = ''; let latestFinal = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) latestFinal += piece;
          else latestInterim += piece;
        }
        const activeText = (latestFinal || latestInterim).trim();
        if (activeText) {
          setLiveStreamText(activeText);
          processRecognizedRef.current?.(activeText, Boolean(latestFinal));
        }
        if (event.results.length > 6 && Boolean(latestFinal)) {
          try { rec.stop(); } catch (e) {}
        }
      };

      rec.onerror = (e: any) => {
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          setIsLiveActive(false); isLiveActiveRef.current = false; return;
        }
        if (isLiveActiveRef.current) setTimeout(() => startFreshWebRecognizer(), 150);
      };

      rec.onend = () => {
        if (isLiveActiveRef.current) setTimeout(() => startFreshWebRecognizer(), 60);
      };

      webRecRef.current = rec;
      lastTranscriptTimeRef.current = Date.now();
      rec.start();
    } catch (err) {
      if (isLiveActiveRef.current) setTimeout(() => startFreshWebRecognizer(), 300);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (isLiveActive) {
        startFreshWebRecognizer();
        if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
        watchdogTimerRef.current = setInterval(() => {
          if (isLiveActiveRef.current && Date.now() - lastTranscriptTimeRef.current > 8000) {
            lastTranscriptTimeRef.current = Date.now();
            startFreshWebRecognizer();
          }
        }, 3000);
      } else {
        if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
        if (webRecRef.current) {
          try { webRecRef.current.onend = null; webRecRef.current.abort(); } catch (e) {}
        }
      }
      return () => {
        if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
        if (webRecRef.current) {
          try { webRecRef.current.onend = null; webRecRef.current.abort(); } catch (e) {}
        }
      };
    }
  }, [isLiveActive, currentLang, isTranslateMode]);

  // NATIVE SPEECH (Android/iOS)
  useEffect(() => {
    if (Platform.OS === 'web' || !NativeSpeechModule) return;
    const subStart = attachNativeSpeechEvent('start', () => setIsLiveActive(true));
    const subEnd = attachNativeSpeechEvent('end', () => {
      if (isLiveActiveRef.current) {
        setTimeout(() => {
          try { NativeSpeechModule.start({ lang: currentLang, interimResults: true, continuous: true }); } catch (e) {}
        }, 250);
      }
    });
    const subResult = attachNativeSpeechEvent('result', (event: any) => {
      const resultsArr = event?.results || event?.value || [];
      const latestItem = Array.isArray(resultsArr) && resultsArr.length > 0 ? resultsArr[resultsArr.length - 1] : resultsArr[0];
      const transcript = (typeof latestItem === 'string' ? latestItem : latestItem?.transcript) || event?.results?.[0]?.transcript || '';
      const isFinal = Boolean(event?.isFinal);
      if (transcript && transcript.trim()) {
        setLiveStreamText(transcript.trim());
        processRecognizedRef.current?.(transcript.trim(), isFinal);
      }
    });
    const subError = attachNativeSpeechEvent('error', (event: any) => {
      if (isLiveActiveRef.current && (event?.error === 'no-speech' || event?.error === '7')) {
        setTimeout(() => {
          try { NativeSpeechModule.start({ lang: currentLang, interimResults: true, continuous: true }); } catch (e) {}
        }, 400);
      }
    });
    return () => { subStart?.remove?.(); subEnd?.remove?.(); subResult?.remove?.(); subError?.remove?.(); };
  }, [currentLang, isTranslateMode]);

  const toggleLiveListening = async () => {
    const nextState = !isLiveActive;
    if (nextState) {
      if (Platform.OS !== 'web') {
        if (!NativeSpeechModule) return;
        try {
          const perm = await NativeSpeechModule.requestPermissionsAsync();
          if (!perm.granted) return;
          setIsLiveActive(true);
          setLiveStreamText(currentLang === 'zh-TW' ? '請開始說話...' : 'Listening for speech...');
          await NativeSpeechModule.start({ lang: currentLang, interimResults: true, continuous: true });
        } catch (e) { setIsLiveActive(false); }
      } else {
        setIsLiveActive(true);
        setLiveStreamText(currentLang === 'zh-TW' ? '請開始說話...' : 'Listening for speech...');
        try {
          startFreshWebRecognizer();
        } catch (e) {}
      }
    } else {
      setIsLiveActive(false);
      if (Platform.OS !== 'web') {
        try { await NativeSpeechModule?.stop(); } catch (e) {}
      } else {
        try { webRecRef.current?.abort?.(); } catch (e) {}
      }
      setLiveStreamText(''); setSmartReplies([]);
    }
  };

  const pullFromCloud = async () => {
    try {
      const res = await fetch(CLOUD_SYNC_URL);
      if (!res.ok) return;
      const data = await res.json();
      setCloudSynced(true);
      if (Array.isArray(data?.venues) && data.venues.length > 0) {
        setVenues(data.venues);
        setActiveVenue((prev) => data.venues.find((v: any) => v.id === prev.id) || data.venues[0]);
      }
      if (Array.isArray(data?.cards) && data.cards.length > 0) setCardsData(sanitizeCardsList(data.cards));
      if (data?.carrierCode) setCarrierCode(data.carrierCode);
    } catch (e) {}
  };

  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const getItem = async (key: string) => Platform.OS === 'web' ? localStorage.getItem(key) : await AsyncStorage.getItem(key);
        const savedCards = await getItem(STORAGE_KEYS.CARDS);
        if (savedCards) setCardsData(sanitizeCardsList(JSON.parse(savedCards)));
        const savedTheme = await getItem(STORAGE_KEYS.THEME_MODE);
        if (savedTheme === 'light' || savedTheme === 'dark') setThemeMode(savedTheme);
      } catch (e) {}
      await pullFromCloud();
    };
    loadSavedData();
  }, []);

  const handleSelectOption = (reply: any, optObj?: any) => {
    const displayToClerk = (optObj?.labels?.['zh-TW'] || reply.clerkText || reply.text || '').replace(/，?謝謝/g, '').trim();
    if (optObj?.kind === 'type') {
      setIsTypeToClerkOpen(true);
      return;
    }
    triggerHaptic(80);
    const shouldShowBarcode = Boolean(optObj?.showBarcode) || /手機條碼|載具|掃條碼/.test(displayToClerk);
    setShowClerkBarcode(shouldShowBarcode);
    setChosenOption(optObj || reply);

    // ✨ ORDER COMBO BUILDER LOGIC
    if (displayToClerk && displayToClerk.length <= 8 && !shouldShowBarcode) {
      setComboItems((prev) => (prev.includes(displayToClerk) ? prev : [...prev.slice(-4), displayToClerk]));
    }

    setClerkLabel(shouldShowBarcode ? (currentLang === 'zh-TW' ? '請掃描手機載具條碼' : 'Scan Carrier') : (currentLang === 'zh-TW' ? '我的回答' : 'My Answer'));
    setClerkMessage(displayToClerk);
    setClerkSub(shouldShowBarcode ? `載具號碼：${carrierCode}` : (currentLang === 'zh-TW' ? '請直接對手機說話，或點選問題' : 'Speak to phone or tap a question'));
    speakSentence(displayToClerk, 'zh-TW');
    setSmartReplies([]);
  };

  const openCardStage = (card: any) => {
    const qText = card.question?.[currentLang] || card.question?.['zh-TW'] || '';
    setPendingAmount(null); setShowClerkBarcode(false); setActivePromptCard(card); setChosenOption(null);
    setClerkLabel(currentLang === 'zh-TW' ? '我正在看您的問題' : 'Reading your question');
    setClerkMessage(card.question?.['zh-TW'] || qText);
    setClerkSub(currentLang === 'zh-TW' ? '請稍等，我選一下' : 'One moment, choosing an answer');
  };

  const resetStageToIdle = () => {
    setActivePromptCard(null); setChosenOption(null); setPendingAmount(null); setShowClerkBarcode(false);
    setClerkLabel(''); setClerkMessage(''); setClerkSub('');
  };

  const toggleThemeMode = () => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const fs = (base: number) => Math.round(base * fontScale);
  const getVenueShortName = (v: any) => typeof v.short === 'object' ? (v.short[currentLang] || v.short['zh-TW']) : v.short;
  const getActiveCoverImage = () => customWallpapers[activeVenue.id] || activeVenue.coverImage;

  // ============================================================================
  // 🏠 HOME SCREEN
  // ============================================================================
  if (!isCounterMode) {
    return (
      <View style={[styles.screen, { backgroundColor: THEME.bg, paddingTop: insets.top }]}>
        <AmbientBackground themeMode={themeMode} isListening={false} />
        <View style={styles.homeHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.brandBadgeIcon, { backgroundColor: THEME.orange }]}>
              <Ionicons name="chatbubbles" size={fs(18)} color="#000" />
            </View>
            <Text style={[styles.homeTitleLogo, { color: THEME.text, fontSize: fs(21) }]}>
              {currentLang === 'zh-TW' ? '看得見的對話' : 'Mochi'}
            </Text>
            {cloudSynced && <View style={styles.cloudDotBadge} />}
          </View>
          <View style={styles.topRightControls}>
            <Pressable onPress={() => setIsSettingsOpen(true)} style={({ pressed }) => [styles.iconBtn, { backgroundColor: THEME.surface, borderColor: THEME.border }, pressed && { transform: [{ scale: 0.95 }] }]}>
              <Ionicons name="options-outline" size={fs(18)} color={THEME.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.greetingSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name={themeMode === 'dark' ? 'moon' : 'sunny'} size={fs(16)} color={THEME.orange} />
              <Text style={{ color: THEME.orange, fontSize: fs(13), fontWeight: '800', letterSpacing: 0.6 }}>
                {themeMode === 'dark' ? 'MIDNIGHT MODE' : 'DAYLIGHT MODE'}
              </Text>
            </View>
            <Text style={[styles.greetingTitle, { color: THEME.text, fontSize: fs(28) }]}>{currentLang === 'zh-TW' ? '準備好開始對話' : 'Ready to Communicate'}</Text>
          </View>

          <View style={[styles.heroCard, { backgroundColor: THEME.surface, borderColor: THEME.border }]}>
            <View style={{ width: '100%', position: 'relative' }}>
              <Image source={{ uri: getActiveCoverImage() }} style={styles.heroImageCentered} />
              <View style={styles.heroImageBadge}>
                <Text style={{ color: '#FFF', fontSize: fs(12), fontWeight: '700' }}>{activeVenue.emoji} {getVenueShortName(activeVenue)}</Text>
              </View>
            </View>
            <View style={styles.heroContent}>
              <Text style={[styles.heroTitle, { color: THEME.text, fontSize: fs(23), marginBottom: 14 }]}>{activeVenue.name[currentLang] || activeVenue.name['zh-TW']}</Text>
              <Pressable style={({ pressed }) => [styles.startModeBtn, { backgroundColor: THEME.orange }, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]} onPress={() => { resetStageToIdle(); setIsCounterMode(true); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="swap-vertical" size={fs(20)} color="#000" />
                  <Text style={[styles.startModeBtnText, { fontSize: fs(17) }]}>{currentLang === 'zh-TW' ? '開始櫃檯模式' : 'Start Counter Mode'}</Text>
                </View>
              </Pressable>
            </View>
          </View>

          <View style={styles.carouselSection}>
            <Text style={[styles.carouselTitle, { color: THEME.text, fontSize: fs(17), paddingLeft: 16 }]}>{currentLang === 'zh-TW' ? '切換所有場景' : 'All Situations'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselScroll}>
              {venues.map((v) => {
                const isSelected = activeVenue.id === v.id;
                return (
                  <Pressable key={v.id} style={({ pressed }) => [styles.carouselItem, pressed && { transform: [{ scale: 0.95 }] }]} onPress={() => setActiveVenue(v)}>
                    <View style={[styles.carouselImgRing, isSelected && { borderColor: THEME.orange, borderWidth: 2.5 }]}>
                      <Image source={{ uri: customWallpapers[v.id] || v.coverImage }} style={styles.carouselItemImg} />
                    </View>
                    <Text style={[styles.carouselItemText, { color: THEME.textMuted, fontSize: fs(13) }, isSelected && { color: THEME.orange, fontWeight: '800' }]} numberOfLines={1}>{getVenueShortName(v)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        <Modal visible={isSettingsOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <ScrollView style={[styles.settingsModalCardFull, { backgroundColor: THEME.bg }]} contentContainerStyle={{ padding: 24 }}>
              <AmbientBackground themeMode={themeMode} />
              <View style={styles.settingsHeader}>
                <TouchableOpacity onPress={() => setIsSettingsOpen(false)}><Ionicons name="arrow-back" size={fs(26)} color={THEME.text} /></TouchableOpacity>
                <Text style={[styles.settingsModalTitle, { color: THEME.text, fontSize: fs(22) }]}>{currentLang === 'zh-TW' ? '設定' : 'Settings'}</Text>
                <View style={{ width: 24 }} />
              </View>
              <View style={[styles.themeShowcaseCard, { backgroundColor: THEME.surface, borderColor: THEME.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: THEME.orange, fontSize: fs(12), fontWeight: '800' }}>{themeMode === 'dark' ? 'MIDNIGHT SKY' : 'DAYLIGHT SKY'}</Text>
                  <Text style={{ color: THEME.text, fontSize: fs(19), fontWeight: '800', marginTop: 2 }}>{themeMode === 'dark' ? '星夜深色主題' : '晴空淺色主題'}</Text>
                </View>
                <DayNightScenerySwitch themeMode={themeMode} onToggle={toggleThemeMode} />
              </View>
              <TouchableOpacity style={[styles.sendBtn, { marginTop: 24 }]} onPress={() => setIsSettingsOpen(false)}>
                <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>完成</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  // ============================================================================
  // 🔄 COUNTER SPLIT MODE
  // ============================================================================
  const prioritizedCards = getPrioritizedCards();

  return (
    <View style={[styles.screen, { backgroundColor: THEME.bg }]}>
      <AmbientBackground themeMode={themeMode} isListening={isLiveActive} isCounter />

      <View style={[styles.splitTop, { backgroundColor: THEME.clerkBg, paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.splitTopInner}>
          <View style={styles.clerkTopActionRow}>
            <Pressable style={({ pressed }) => [styles.clerkOfflinePickPill, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]} onPress={() => { setClerkPickView('grid'); setIsClerkPickOpen(true); }}>
              <Text style={[styles.clerkOfflinePickText, { fontSize: fs(17) }]}>{currentLang === 'zh-TW' ? '或點這裡，選您要問的問題' : 'Tap here to pick a question'}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.clerkRoundSpeakBtn, pressed && { transform: [{ scale: 0.92 }], opacity: 0.8 }]} onPress={() => speakSentence(clerkMessage || '我是聽障者，請對著手機說話', 'zh-TW')}>
              <Ionicons name="volume-high" size={fs(26)} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.clerkMainMessageContainer}>
            {clerkMessage ? (
              <>
                {!!clerkLabel && <Text style={[styles.clerkStatusLabel, { fontSize: fs(16) }]}>{clerkLabel}</Text>}
                <Text style={[styles.clerkMainMessageLarge, { fontSize: fs(showClerkBarcode ? 30 : clerkMessage.length <= 5 ? 54 : 38) }]}>{clerkMessage}</Text>
                {showClerkBarcode && (
                  <View style={styles.clerkBarcodeCard}>
                    <View style={styles.clerkBarcodeBarsRow}>
                      {BARCODE_WEIGHTS.map((w, i) => <View key={i} style={{ width: w * 2.2, height: 44, backgroundColor: i % 2 === 0 ? '#000' : 'transparent' }} />)}
                    </View>
                    <Text style={styles.clerkBarcodeCodeText}>{carrierCode}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.clerkStatusLabel, { fontSize: fs(16) }]}>溝通提示卡</Text>
                <Text style={[styles.clerkDefaultHeadline, { fontSize: fs(36) }]}>我是聽障者</Text>
                <Text style={[styles.clerkDefaultHeadline, { fontSize: fs(36), color: THEME.orange }]}>請對著手機說話</Text>
                <Text style={[styles.clerkDefaultSub, { fontSize: fs(16) }]}>我會用螢幕回答您</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <View style={styles.splitAmberDivider} />

      <View style={[styles.splitBottom, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.bottomHeaderGroup}>
          <View style={styles.bottomHeader}>
            <Pressable style={({ pressed }) => [styles.venueDropdown, { backgroundColor: THEME.surface, borderColor: THEME.border }, pressed && { opacity: 0.8 }]} onPress={() => setIsCounterMode(false)}>
              <Text style={[styles.venueDropdownText, { color: THEME.text, fontSize: fs(15) }]}>{activeVenue.emoji} {getVenueShortName(activeVenue)} ▾</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable style={({ pressed }) => [styles.offlineModePill, { backgroundColor: THEME.surfaceLight, borderColor: THEME.orange }, pressed && { transform: [{ scale: 0.96 }] }]} onPress={() => { setClerkPickView('grid'); setIsClerkPickOpen(true); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="grid-outline" size={fs(14)} color={THEME.orange} /><Text style={[styles.offlineModePillText, { fontSize: fs(14) }]}>店員點選</Text></View>
              </Pressable>
              
              {/* 🔔 RECEIPT NUMBER WATCHER PILL */}
              <Pressable
                style={({ pressed }) => [
                  styles.smallSettingsBtn,
                  { backgroundColor: watchNumber ? 'rgba(255, 159, 28, 0.18)' : THEME.surface, borderColor: watchNumber ? THEME.orange : THEME.border },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setIsNumberModalOpen(true)}
              >
                <Text style={{ color: watchNumber ? THEME.orange : THEME.text, fontSize: fs(13), fontWeight: '800' }}>
                  {watchNumber ? `🔔 #${watchNumber}` : '🔔 叫號'}
                </Text>
              </Pressable>

              <Pressable style={({ pressed }) => [styles.liveStatusPill, { backgroundColor: isLiveActive ? 'rgba(46, 196, 182, 0.16)' : THEME.surface, borderColor: isLiveActive ? THEME.success : THEME.border }, pressed && { transform: [{ scale: 0.96 }] }]} onPress={toggleLiveListening}>
                <LiveAudioWave active={isLiveActive} color={THEME.success} />
                <Text style={[styles.liveStatusText, { color: isLiveActive ? THEME.success : THEME.text, fontSize: fs(14) }]}>{isLiveActive ? '正在聽' : '點我開始聽'}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.smallSettingsBtn, { backgroundColor: THEME.surface, borderColor: THEME.border }, pressed && { opacity: 0.7 }]} onPress={() => setIsSettingsOpen(true)}>
                <Text style={{ color: THEME.text, fontSize: fs(15), fontWeight: '800' }}>Aa</Text>
              </Pressable>
            </View>
          </View>

          {/* 🎉 NUMBER CALLED ALERT BANNER */}
          {numberCalledAlert && (
            <Pressable
              style={{ backgroundColor: THEME.orange, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              onPress={() => { setNumberCalledAlert(false); setWatchNumber(''); }}
            >
              <Text style={{ color: '#000', fontSize: fs(17), fontWeight: '900' }}>🎉 到您了！櫃檯正在叫 #{watchNumber} 號</Text>
              <Text style={{ color: '#000', fontSize: fs(13), fontWeight: '800' }}>關閉 ✕</Text>
            </Pressable>
          )}

          {/* 🧋 MULTI-SELECT ORDER COMBO BUILDER TRAY */}
          {comboItems.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: THEME.surface, borderColor: THEME.orange, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, gap: 8 }}>
              <Text style={{ color: THEME.text, fontSize: fs(14), fontWeight: '700', flex: 1 }} numberOfLines={1}>
                ✨ 組合：{comboItems.join(' · ')}
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: THEME.orange, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                onPress={() => {
                  const fullSentence = comboItems.join('、');
                  setClerkLabel(currentLang === 'zh-TW' ? '我的完整點餐' : 'My Full Order');
                  setClerkMessage(fullSentence);
                  speakSentence(fullSentence, 'zh-TW');
                }}
              >
                <Text style={{ color: '#000', fontSize: fs(13), fontWeight: '800' }}>🔊 整句唸出</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setComboItems([])} style={{ paddingHorizontal: 4 }}>
                <Text style={{ color: THEME.textMuted, fontSize: fs(14) }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {liveStreamText ? (
            <View style={[styles.liveSubtitleBox, { backgroundColor: THEME.surfaceLight, borderColor: THEME.success }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.liveSubtitleText, { color: THEME.success, fontSize: fs(18) }]}>"{liveStreamText}"</Text>
              </View>
              <TouchableOpacity style={[styles.subtitleSpeakerBtn, { backgroundColor: THEME.surface, borderColor: THEME.orange }]} onPress={() => speakSentence(liveStreamText)}>
                <Ionicons name="volume-high" size={fs(20)} color={THEME.orange} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <ScrollView style={styles.questionsList} contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
          {activePromptCard ? (
            <View style={[styles.stageActiveCard, { backgroundColor: THEME.surface, borderColor: THEME.orange }]}>
              <View style={styles.stageCardHeader}>
                <TouchableOpacity onPress={resetStageToIdle} style={styles.stageBackBtn}><Text style={[styles.stageBackText, { color: THEME.textMuted, fontSize: fs(15) }]}>‹ 返回</Text></TouchableOpacity>
                <Text style={[styles.stageCardCaption, { color: THEME.textMuted, fontSize: fs(14) }]}>店員在問</Text>
                <TouchableOpacity onPress={() => speakSentence(activePromptCard.question?.['zh-TW'], 'zh-TW')} style={[styles.stageSpeakSmallBtn, { backgroundColor: THEME.surfaceLight }]}><Ionicons name="volume-high" size={fs(18)} color={THEME.orange} /></TouchableOpacity>
              </View>
              <Text style={[styles.stageQuestionHeadline, { color: THEME.text, fontSize: fs(28) }]}>{activePromptCard.question?.['zh-TW']}</Text>
              <View style={styles.stageOptionsGrid}>
                {activePromptCard.options.map((opt: any, idx: number) => {
                  const isFullWidth = idx === activePromptCard.options.length - 1 && activePromptCard.options.length % 2 === 1;
                  const optLabel = opt.labels['zh-TW'];
                  const isSelected = chosenOption?.labels?.['zh-TW'] === optLabel;
                  return (
                    <View key={idx} style={[styles.stageOptionCell, { width: isFullWidth ? '100%' : '50%' }]}>
                      <Pressable style={({ pressed }) => [styles.stageOptionTile, { backgroundColor: THEME.bg, borderColor: THEME.border }, isSelected && styles.stageOptionTileSelected, pressed && { transform: [{ scale: 0.97 }] }]} onPress={() => handleSelectOption({ text: optLabel, clerkText: opt.tts || optLabel }, opt)}>
                        <Text style={[styles.stageOptionTileText, { color: THEME.text, fontSize: fs(20) }, isSelected && { color: '#000', fontWeight: '800' }]}>{optLabel}</Text>
                        {opt.subLabels && <Text style={[styles.stageOptionTileSub, { color: THEME.textMuted, fontSize: fs(13) }, isSelected && { color: 'rgba(0,0,0,0.7)' }]}>{opt.subLabels['zh-TW']}</Text>}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {prioritizedCards.map((card) => {
            const qTitle = card.question?.['zh-TW'];
            return (
              <View key={card.id} style={[styles.cardGroupBox, { backgroundColor: THEME.surface, borderColor: THEME.border }]}>
                {qTitle && (
                  <View style={[styles.cardQuestionHeaderRow, { backgroundColor: THEME.surfaceLight, borderBottomColor: THEME.border }]}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => openCardStage(card)}>
                      <Text style={[styles.cardQuestionHeaderText, { fontSize: fs(16) }]}>{card.isCustom ? '✨ ' : ''}{qTitle}</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity style={[styles.rowSpeakerIconBtn, { backgroundColor: THEME.bg, borderColor: THEME.border }]} onPress={() => speakSentence(qTitle, 'zh-TW')}>
                        <Ionicons name="volume-high-outline" size={fs(18)} color={THEME.orange} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {card.options.map((opt: any, idx: number) => {
                  const mainLabel = opt.labels['zh-TW'];
                  return (
                    <View key={`${card.id}_${idx}`} style={[styles.questionRow, { borderBottomColor: THEME.border }]}>
                      <TouchableOpacity style={styles.questionTextCol} onPress={() => handleSelectOption({ text: mainLabel, clerkText: opt.tts || mainLabel }, opt)}>
                        <Text style={[styles.questionTitle, { color: THEME.text, fontSize: fs(19) }]}>{mainLabel}</Text>
                        {opt.subLabels && <Text style={[styles.questionSub, { color: THEME.textMuted, fontSize: fs(14) }]}>{opt.subLabels['zh-TW']}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.rowSpeakerIconBtn, { backgroundColor: THEME.bg, borderColor: THEME.border }]} onPress={() => speakSentence(opt.tts || mainLabel, 'zh-TW')}>
                        <Ionicons name="volume-high-outline" size={fs(18)} color={THEME.text} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        {/* 🔔 STANDALONE POLITE PHRASES BAR (Chime & Thank you) */}
        <View style={{ flexDirection: 'row', gap: 8, paddingTop: 6 }}>
          {[
            { zh: '謝謝', en: 'Thank you', icon: '🙏' },
            { zh: '好的，謝謝', en: 'OK, thanks', icon: '👍' },
            { zh: '不好意思', en: 'Excuse me', icon: '🔔', chime: true },
          ].map((item) => (
            <Pressable
              key={item.zh}
              style={({ pressed }) => [
                { flex: 1, backgroundColor: THEME.surface, borderColor: THEME.orange, borderWidth: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
                pressed && { transform: [{ scale: 0.96 }], opacity: 0.85 },
              ]}
              onPress={() => {
                if (item.chime) playAttentionChime();
                else triggerHaptic(60);
                setShowClerkBarcode(false);
                setClerkLabel(currentLang === 'zh-TW' ? '禮貌致意' : 'Polite Note');
                setClerkMessage(item.zh);
                speakSentence(item.zh, 'zh-TW');
              }}
            >
              <Text style={{ color: THEME.text, fontSize: fs(14), fontWeight: '800' }}>
                {item.icon} {item.zh}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Bottom Action Bar */}
        <View style={[styles.bottomActionBar, { backgroundColor: 'transparent' }]}>
          <Pressable style={({ pressed }) => [styles.actionBtnSecondary, { backgroundColor: THEME.surface, borderColor: THEME.border }, pressed && { transform: [{ scale: 0.98 }] }]} onPress={() => { setShowClerkBarcode(false); setClerkLabel('請再說一次'); setClerkMessage('可以再說一次嗎？'); speakSentence('不好意思，我沒聽清楚，可以再說一次或用點的嗎？', 'zh-TW'); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="help-circle-outline" size={fs(18)} color={THEME.text} /><Text style={[styles.actionBtnSecondaryText, { color: THEME.text, fontSize: fs(16) }]}>我沒聽懂 / 再說一次</Text></View>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.actionBtnPrimary, { backgroundColor: THEME.surfaceLight }, pressed && { transform: [{ scale: 0.98 }] }]} onPress={() => setIsTypeToClerkOpen(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="create-outline" size={fs(18)} color={THEME.text} /><Text style={[styles.actionBtnPrimaryText, { color: THEME.text, fontSize: fs(16) }]}>打字</Text></View>
          </Pressable>
        </View>
      </View>

      {/* Modal: Receipt Number Call Watcher (叫號提醒) */}
      <Modal visible={isNumberModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.typeModalCard, { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border }]}>
            <Text style={[styles.settingsModalTitle, { color: THEME.text, fontSize: fs(20), marginBottom: 6 }]}>🔔 號碼牌叫號提醒</Text>
            <Text style={{ color: THEME.textMuted, fontSize: fs(13), marginBottom: 12 }}>輸入您的取餐號碼（例如：68），開啟語音監聽後，店員叫號時畫面會自動閃爍提醒您：</Text>
            <TextInput
              style={[styles.inputField, { backgroundColor: THEME.bg, color: THEME.text, borderColor: THEME.border, fontSize: fs(24), fontWeight: '900', textAlign: 'center' }]}
              placeholder="例如：68" placeholderTextColor={THEME.textMuted} keyboardType="numeric" value={watchNumber} onChangeText={(t) => { setWatchNumber(t.trim()); setNumberCalledAlert(false); }}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => { setIsNumberModalOpen(false); if (watchNumber && !isLiveActive) { toggleLiveListening(); } }}>
              <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>{watchNumber ? `✓ 開始監聽 #${watchNumber} 號` : '完成'}</Text>
            </TouchableOpacity>
            {!!watchNumber && (
              <TouchableOpacity style={[styles.closeBtn, { marginTop: 8 }]} onPress={() => { setWatchNumber(''); setNumberCalledAlert(false); setIsNumberModalOpen(false); }}>
                <Text style={[styles.closeBtnText, { color: THEME.danger, fontSize: fs(14) }]}>清除號碼</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Offline Clerk Pick Grid */}
      <Modal visible={isClerkPickOpen} animationType="fade" transparent={false} onRequestClose={() => setIsClerkPickOpen(false)}>
        <View style={styles.clerkPickModalRoot}>
          <View style={[styles.clerkPickRotatedArea, { paddingTop: Math.max(insets.bottom, 16), paddingBottom: Math.max(insets.top, 16) }]}>
            <View style={styles.clerkPickHeader}>
              <Text style={[styles.clerkPickOrangeSub, { fontSize: fs(16) }]}>太吵了也沒關係</Text>
              <Text style={[styles.clerkPickMainTitle, { fontSize: fs(30) }]}>請點您要問的問題</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.clerkPickGrid}>
              {prioritizedCards.map((card) => (
                <View key={card.id} style={styles.clerkPickCell}>
                  <TouchableOpacity style={styles.clerkPickTile} onPress={() => handleClerkPickCard(card)}>
                    <Text style={[styles.clerkPickTileText, { fontSize: fs(21) }]} numberOfLines={2}>{card.question?.['zh-TW']}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity style={[styles.clerkPickUserCancelBar, { paddingBottom: Math.max(insets.bottom, 14) }]} onPress={() => setIsClerkPickOpen(false)}>
            <Text style={[styles.clerkPickUserCancelText, { fontSize: fs(16) }]}>↓↑ 取消，回到我這面</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Modal: Type to Clerk */}
      <Modal visible={isTypeToClerkOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.typeModalCard, { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border }]}>
            <Text style={[styles.settingsModalTitle, { color: THEME.text, fontSize: fs(20), marginBottom: 8 }]}>✏️ 打字給對方看</Text>
            <TextInput style={[styles.inputField, { backgroundColor: THEME.bg, color: THEME.text, borderColor: THEME.border, fontSize: fs(17), minHeight: 80 }]} placeholder="輸入回答..." placeholderTextColor={THEME.textMuted} value={customTypeInput} onChangeText={setCustomTypeInput} multiline autoFocus />
            <TouchableOpacity style={styles.sendBtn} onPress={handleTypeToClerkSubmit}><Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>🔊 顯示並發音</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.closeBtn, { marginTop: 8 }]} onPress={() => setIsTypeToClerkOpen(false)}><Text style={[styles.closeBtnText, { color: THEME.textMuted, fontSize: fs(15) }]}>關閉</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Quick Font & Animated Day/Night Switch in Counter Mode ("Aa") */}
      <Modal visible={isSettingsOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.typeModalCard, { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border }]}>
            <Text style={[styles.settingsModalTitle, { color: THEME.text, fontSize: fs(20), marginBottom: 12 }]}>字體大小調整</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {FONT_SCALE_OPTIONS.map((f) => (
                <TouchableOpacity key={f.label} style={[styles.fontBtn, { backgroundColor: THEME.bg, borderColor: THEME.border }, fontScale === f.val && { backgroundColor: THEME.orange, borderColor: THEME.orange }]} onPress={() => persistFontScale(f.val)}>
                  <Text style={[styles.fontBtnText, { color: THEME.text, fontSize: fs(14) }, fontScale === f.val && { color: '#000', fontWeight: '800' }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.themeShowcaseCard, { backgroundColor: THEME.bg, borderColor: THEME.border, marginBottom: 16, padding: 14 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: THEME.text, fontSize: fs(16), fontWeight: '800' }}>{themeMode === 'dark' ? '🌙 星夜深色' : '☀️ 晴空淺色'}</Text>
                <Text style={{ color: THEME.textMuted, fontSize: fs(12), marginTop: 2 }}>點擊切換日夜背景</Text>
              </View>
              <DayNightScenerySwitch themeMode={themeMode} onToggle={toggleThemeMode} />
            </View>
            <TouchableOpacity style={styles.sendBtn} onPress={() => setIsSettingsOpen(false)}><Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>完成</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  auroraOrb: { position: 'absolute', ...(Platform.OS === 'web' ? { filter: 'blur(60px)' } : {}) },
  scenerySwitchTrack: { width: 126, height: 48, borderRadius: 999, borderWidth: 1.5, justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  sceneryTrackDecorLeft: { position: 'absolute', left: 14, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sceneryTrackDecorRight: { position: 'absolute', right: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sceneryTrackLabelDark: { color: '#D8E2FF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  sceneryTrackLabelLight: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  scenerySwitchThumb: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  themeShowcaseCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 20, borderWidth: 1 },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 10, paddingHorizontal: 16 },
  brandBadgeIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  homeTitleLogo: { fontWeight: '800', letterSpacing: -0.4, fontFamily: FONT_FAMILY },
  cloudDotBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2EC4B6' },
  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontWeight: '700' },
  toastBanner: { backgroundColor: 'rgba(46, 196, 182, 0.18)', borderWidth: 1, borderColor: '#2EC4B6', marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  toastBannerText: { color: '#2EC4B6', fontWeight: '700' },
  satelliteDropdownContainer: { paddingHorizontal: 16, marginBottom: 14, zIndex: 100 },
  satelliteEditorCard: { padding: 14, borderRadius: 18, borderWidth: 1.5 },
  satelliteFoundLabel: { color: '#2EC4B6', fontWeight: '700' },
  nearbyPulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2EC4B6' },
  rescanSmallBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  candidateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  candidateChipActive: { backgroundColor: '#FF9F1C', borderColor: '#FF9F1C' },
  candidateChipText: { fontWeight: '600' },
  editableLocationInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontWeight: '700', marginBottom: 10 },
  templateTypeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  templateTypeChipActive: { backgroundColor: '#FF9F1C', borderColor: '#FF9F1C' },
  templateTypeChipText: { fontWeight: '600' },
  saveLocationConfirmBtn: { backgroundColor: '#FF9F1C', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveLocationConfirmBtnText: { color: '#000', fontWeight: '800' },
  dismissPillBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  mainScroll: { flex: 1 },
  greetingSection: { marginBottom: 16, marginTop: 6, paddingHorizontal: 16 },
  greetingTitle: { fontWeight: '800', letterSpacing: -0.5, marginBottom: 4, fontFamily: FONT_FAMILY },
  greetingSub: { fontWeight: '500', fontFamily: FONT_FAMILY },
  heroCard: { borderRadius: 28, overflow: 'hidden', marginBottom: 26, borderWidth: 1.5, alignItems: 'center', marginHorizontal: 16, shadowColor: '#060B1E', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 10 },
  heroImageCentered: { width: '100%', height: 180, resizeMode: 'cover' },
  heroImageBadge: { position: 'absolute', bottom: 12, left: 14, backgroundColor: 'rgba(8, 11, 26, 0.72)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  heroContent: { padding: 20, width: '100%' },
  heroTitle: { fontWeight: '800', letterSpacing: -0.3, fontFamily: FONT_FAMILY },
  startModeBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10, width: '100%', shadowColor: '#FF9F1C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
  startModeBtnText: { color: '#000', fontWeight: '800', fontFamily: FONT_FAMILY },
  heroHint: { textAlign: 'center', fontFamily: FONT_FAMILY },
  carouselSection: { paddingLeft: 16 },
  carouselTitle: { fontWeight: '700', marginBottom: 14, fontFamily: FONT_FAMILY },
  carouselScroll: { gap: 14, paddingBottom: 20, paddingRight: 16, paddingTop: 4 },
  carouselItem: { alignItems: 'center', width: 84 },
  carouselImgRing: { padding: 3, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', marginBottom: 6 },
  carouselItemImg: { width: 68, height: 68, borderRadius: 15 },
  carouselItemText: { fontWeight: '600', fontFamily: FONT_FAMILY, textAlign: 'center' },
  manageVenueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1 },
  manageVenueDeleteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255, 77, 109, 0.15)' },
  splitTop: { flex: 0.94, justifyContent: 'space-between', alignItems: 'center' },
  splitTopInner: { flex: 1, width: '100%', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 12, transform: [{ rotate: '180deg' }] },
  clerkTopActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 },
  clerkOfflinePickPill: { flex: 1, backgroundColor: '#FF9F1C', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  clerkOfflinePickText: { color: '#000000', fontWeight: '800', fontFamily: FONT_FAMILY },
  clerkRoundSpeakBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  clerkMainMessageContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  clerkStatusLabel: { color: '#FF9F1C', fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  clerkDefaultHeadline: { fontWeight: '800', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.5, fontFamily: FONT_FAMILY },
  clerkDefaultSub: { fontWeight: '600', color: '#9BA8D2', marginTop: 8, textAlign: 'center', fontFamily: FONT_FAMILY },
  clerkMainMessageLarge: { fontWeight: '800', color: '#FFFFFF', textAlign: 'center', fontFamily: FONT_FAMILY },
  clerkBarcodeCard: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6, borderWidth: 2, borderColor: '#FF9F1C' },
  clerkBarcodeBarsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  clerkBarcodeCodeText: { color: '#000000', fontWeight: '900', fontSize: 16, letterSpacing: 3, marginTop: 4, fontVariant: ['tabular-nums'] },
  clerkSecondaryMessage: { fontWeight: '600', color: '#9BA8D2', marginTop: 6, textAlign: 'center', fontFamily: FONT_FAMILY },
  clerkFlipEdgeHint: { color: '#6E7A9E', fontWeight: '600', paddingBottom: 4 },
  splitAmberDivider: { height: 3, backgroundColor: '#FF9F1C' },
  splitBottom: { flex: 1.25, paddingHorizontal: 14, paddingTop: 10 },
  bottomHeaderGroup: { marginBottom: 8, zIndex: 10 },
  bottomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  venueDropdown: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  venueDropdownText: { fontWeight: '700', fontFamily: FONT_FAMILY },
  offlineModePill: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  offlineModePillText: { color: '#FF9F1C', fontWeight: '700' },
  liveStatusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 7 },
  liveStatusText: { fontWeight: '700', fontFamily: FONT_FAMILY },
  smallSettingsBtn: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  smartReplyPillWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#FF9F1C', borderRadius: 999, overflow: 'hidden' },
  smartReplyMainTap: { paddingLeft: 14, paddingRight: 8, paddingVertical: 8 },
  smartReplySpeakerTap: { paddingHorizontal: 10, paddingVertical: 8, borderLeftWidth: 1 },
  smartReplyBtnText: { fontWeight: '700' },
  liveSubtitleBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5 },
  liveSubtitleText: { fontWeight: '700', fontFamily: FONT_FAMILY },
  subtitleSpeakerBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stageActiveCard: { borderRadius: 20, borderWidth: 1.5, padding: 14, marginBottom: 14 },
  stageCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  stageBackBtn: { paddingVertical: 4, paddingRight: 10 },
  stageBackText: { fontWeight: '600' },
  stageCardCaption: { fontWeight: '600' },
  stageSpeakSmallBtn: { padding: 7, borderRadius: 10 },
  stageQuestionHeadline: { fontWeight: '800', marginBottom: 14 },
  stageOptionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  stageOptionCell: { padding: 4 },
  stageOptionTile: { minHeight: 68, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  stageOptionTileSelected: { backgroundColor: '#FF9F1C', borderColor: '#FF9F1C' },
  stageOptionTileText: { fontWeight: '700', textAlign: 'center' },
  stageOptionTileSub: { marginTop: 4, textAlign: 'center' },
  amountDisplayWell: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16, marginBottom: 12 },
  amountCurrencyText: { fontWeight: '600' },
  amountFigureText: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  amountConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  questionsList: { flex: 1 },
  sectionListHeader: { fontWeight: '600', marginBottom: 8, marginTop: 4 },
  addCustomQaBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  cardGroupBox: { borderRadius: 18, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  cardQuestionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  cardQuestionHeaderText: { color: '#FF9F1C', fontWeight: '800' },
  deleteCardSmallBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255, 77, 109, 0.15)' },
  questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  questionTextCol: { flex: 1, gap: 2, paddingRight: 8 },
  questionTitle: { fontWeight: '700', fontFamily: FONT_FAMILY },
  questionSub: { fontFamily: FONT_FAMILY },
  rowSpeakerIconBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bottomActionBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, paddingBottom: 4 },
  actionBtnSecondary: { flex: 1.5, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  actionBtnSecondaryText: { fontWeight: '700', fontFamily: FONT_FAMILY },
  actionBtnPrimary: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  actionBtnPrimaryText: { fontWeight: '700', fontFamily: FONT_FAMILY },
  clerkPickModalRoot: { flex: 1, backgroundColor: '#080B1A' },
  clerkPickRotatedArea: { flex: 1, transform: [{ rotate: '180deg' }], paddingHorizontal: 16 },
  clerkPickHeader: { marginBottom: 14, paddingHorizontal: 4 },
  clerkPickOrangeSub: { color: '#FF9F1C', fontWeight: '700', marginBottom: 4 },
  clerkPickMainTitle: { color: '#FFFFFF', fontWeight: '900' },
  clerkPickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, paddingBottom: 24 },
  clerkPickCell: { width: '50%', padding: 6 },
  clerkPickTile: { height: 100, backgroundColor: '#151D3D', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(165, 185, 255, 0.22)', paddingHorizontal: 14, justifyContent: 'center' },
  clerkPickAmountTile: { flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: '#FF9F1C', borderWidth: 1.5 },
  clerkPickTileText: { color: '#FFFFFF', fontWeight: '700' },
  clerkKeypadContainer: { flex: 1, justifyContent: 'space-between', paddingBottom: 10 },
  clerkKeypadDisplay: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, backgroundColor: '#151D3D', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 16, marginBottom: 10 },
  clerkKeypadCurrency: { color: '#9BA8D2', fontWeight: '600' },
  clerkKeypadFigure: { color: '#FFFFFF', fontWeight: '900', fontVariant: ['tabular-nums'] },
  clerkKeypadGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  clerkKeyCell: { width: '33.333%', padding: 4 },
  clerkKeyBtn: { minHeight: 58, backgroundColor: '#151D3D', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(165, 185, 255, 0.22)', alignItems: 'center', justifyContent: 'center' },
  clerkKeyBtnText: { color: '#FFFFFF', fontWeight: '700', fontVariant: ['tabular-nums'] },
  clerkKeypadGhostBtn: { flex: 1, minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(165, 185, 255, 0.22)', alignItems: 'center', justifyContent: 'center' },
  clerkKeypadSubmitBtn: { flex: 1, minHeight: 54, borderRadius: 12, backgroundColor: '#FF9F1C', alignItems: 'center', justifyContent: 'center' },
  clerkPickUserCancelBar: { borderTopWidth: 1, borderTopColor: 'rgba(165, 185, 255, 0.22)', paddingTop: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080B1A' },
  clerkPickUserCancelText: { color: '#9BA8D2', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(6, 10, 24, 0.85)', justifyContent: 'center', alignItems: 'center' },
  settingsModalCardFull: { width: '100%', height: '100%' },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  settingsModalTitle: { fontWeight: '800', fontFamily: FONT_FAMILY },
  settingsSectionTitle: { fontWeight: '700', marginBottom: 8, marginTop: 12 },
  fontBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  fontBtnText: { fontWeight: '600' },
  typeModalCard: { width: '90%', maxWidth: 380, borderRadius: 24, padding: 24, borderWidth: 1.5 },
  langOptionItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  langOptionText: { fontFamily: FONT_FAMILY },
  settingsDivider: { height: 1, marginVertical: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  settingRowLabel: { fontWeight: '500' },
  toggleSwitch: { width: 48, height: 26, borderRadius: 13, borderWidth: 1, justifyContent: 'center', padding: 2 },
  toggleSwitchActive: { backgroundColor: '#4CC9F0', borderColor: '#4CC9F0' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#9BA8D2' },
  toggleThumbActive: { backgroundColor: '#FFF', transform: [{ translateX: 22 }] },
  closeBtn: { paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { fontWeight: '600', fontFamily: FONT_FAMILY },
  inputField: { width: '100%', minHeight: 56, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  sendBtn: { width: '100%', paddingVertical: 14, borderRadius: 14, backgroundColor: '#FF9F1C', alignItems: 'center' },
  sendBtnText: { color: '#000', fontWeight: '800', fontFamily: FONT_FAMILY },
});

export default CounterConversationScreen;