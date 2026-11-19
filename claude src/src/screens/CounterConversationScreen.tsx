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

// 🛡️ Platform-Guarded Native Speech Loader (Android APK & Web/iOS safe)
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
  } catch (e) {
    console.warn(`Failed to attach ${eventName} listener:`, e);
  }
  return null;
};

// 🎨 PINTEREST WEATHER-UI INSPIRED DAY & NIGHT ATMOSPHERIC PALETTES
const THEMES = {
  dark: {
    bg: '#0B1026', // Deep Midnight Indigo Sky
    surface: 'rgba(23, 31, 66, 0.78)', // Frosted Midnight Glass
    surfaceSolid: '#151D3D',
    surfaceLight: 'rgba(38, 50, 98, 0.85)',
    text: '#F8FAFF',
    textMuted: '#9BA8D2',
    orange: '#FF9F1C', // Warm Amber Gold
    danger: '#FF4D6D',
    success: '#2EC4B6',
    translateAccent: '#4CC9F0',
    border: 'rgba(165, 185, 255, 0.16)',
    clerkBg: '#080B1A',
    clerkCard: '#151D3D',
  },
  light: {
    bg: '#E3F0FF', // Soft Cerulean Daylight Sky
    surface: 'rgba(255, 255, 255, 0.84)', // Frosted Daylight Cloud Glass
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

const FONT_FAMILY =
  Platform.OS === 'web'
    ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    : undefined;

export type SupportedLang = 'en-US' | 'zh-TW';

const STORAGE_KEYS = {
  VENUES: 'mochi_custom_venues_v5',
  CARDS: 'mochi_custom_cards_v6',
  WALLPAPERS: 'mochi_wallpapers_v5',
  FONT_SCALE: 'mochi_font_scale_v5',
  THEME_MODE: 'mochi_theme_mode_v5',
  CARRIER_CODE: 'mochi_carrier_code_v5',
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

  // Inject pure GPU CSS keyframes on Web so the JS speech thread has 0% animation load
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

    // Native Android/iOS hardware-thread animations (runs on UI thread, never blocks JS)
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(drift1, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift1, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(drift2, {
          toValue: 1,
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift2, {
          toValue: 0,
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const loop3 = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 0.95,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0.25,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
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

  const orb1AnimStyle = isWeb
    ? ({ animation: 'mochiFloatSlow 14s ease-in-out infinite', willChange: 'transform' } as any)
    : { transform: [{ translateX: tx1 }, { translateY: ty1 }] };

  const orb2AnimStyle = isWeb
    ? ({ animation: 'mochiFloatReverse 18s ease-in-out infinite', willChange: 'transform' } as any)
    : { transform: [{ translateX: tx2 }, { translateY: ty2 }] };

  const cloudAnimStyle = isWeb
    ? ({ animation: 'mochiCloudDrift 11s ease-in-out infinite', willChange: 'transform' } as any)
    : { transform: [{ translateX: tx1 }] };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {isDark ? (
        <>
          {/* 🌙 Moving Midnight Indigo & Nebula Glow Orbs */}
          <Animated.View
            style={[
              styles.auroraOrb,
              {
                width: 320,
                height: 320,
                borderRadius: 160,
                top: isCounter ? '44%' : -60,
                right: -70,
                backgroundColor: isListening ? '#2EC4B6' : '#4361EE',
                opacity: 0.26,
              },
              orb1AnimStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.auroraOrb,
              {
                width: 280,
                height: 280,
                borderRadius: 140,
                bottom: -60,
                left: -70,
                backgroundColor: '#7209B7',
                opacity: 0.22,
              },
              orb2AnimStyle,
            ]}
          />
          {/* Floating Crescent Moon */}
          {!isCounter && (
            <Animated.View
              style={[
                { position: 'absolute', top: 48, right: 28, opacity: 0.26 },
                cloudAnimStyle,
              ]}
            >
              <Ionicons name="moon" size={64} color="#FFD166" />
            </Animated.View>
          )}
          {/* ✨ Twinkling Night Stars */}
          {STAR_POSITIONS.map((star, idx) => (
            <Animated.View
              key={idx}
              style={[
                {
                  position: 'absolute',
                  top: star.top,
                  left: star.left,
                  width: star.size,
                  height: star.size,
                  borderRadius: star.size / 2,
                  backgroundColor: '#FFFFFF',
                },
                isWeb
                  ? ({
                      animation: `mochiTwinkle ${2.8 + (idx % 3) * 0.9}s ease-in-out infinite`,
                    } as any)
                  : { opacity: twinkle },
              ]}
            />
          ))}
        </>
      ) : (
        <>
          {/* ☀️ Moving Sunny Sky & Golden Sun Orbs */}
          <Animated.View
            style={[
              styles.auroraOrb,
              {
                width: 300,
                height: 300,
                borderRadius: 150,
                top: isCounter ? '42%' : -75,
                right: -55,
                backgroundColor: '#FFD166',
                opacity: 0.48,
              },
              orb1AnimStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.auroraOrb,
              {
                width: 340,
                height: 340,
                borderRadius: 170,
                bottom: -80,
                left: -70,
                backgroundColor: '#90E0EF',
                opacity: 0.45,
              },
              orb2AnimStyle,
            ]}
          />
          {/* Drifting Daylight Sun & Clouds */}
          {!isCounter && (
            <>
              <Animated.View
                style={[
                  { position: 'absolute', top: 42, right: 26, opacity: 0.38 },
                  cloudAnimStyle,
                ]}
              >
                <Ionicons name="partly-sunny" size={72} color="#FF9F1C" />
              </Animated.View>
              <Animated.View
                style={[
                  { position: 'absolute', top: 110, left: 24, opacity: 0.45 },
                  orb2AnimStyle,
                ]}
              >
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
const DayNightScenerySwitch = ({
  themeMode,
  onToggle,
}: {
  themeMode: 'dark' | 'light';
  onToggle: () => void;
}) => {
  const isDark = themeMode === 'dark';
  const slideAnim = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isDark ? 1 : 0,
      friction: 7,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [isDark, slideAnim]);

  const thumbTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 78],
  });

  return (
    <Pressable onPress={onToggle} accessibilityRole="switch" accessibilityState={{ checked: isDark }}>
      <View
        style={[
          styles.scenerySwitchTrack,
          {
            backgroundColor: isDark ? '#121836' : '#72B6FF',
            borderColor: isDark ? 'rgba(165, 185, 255, 0.3)' : 'rgba(255, 255, 255, 0.8)',
          },
        ]}
      >
        {/* Background Scenery Elements inside the Pill Track */}
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

        {/* Sliding Sun / Moon Orb Thumb */}
        <Animated.View
          style={[
            styles.scenerySwitchThumb,
            {
              backgroundColor: isDark ? '#253166' : '#FFE066',
              shadowColor: isDark ? '#000' : '#FF9F1C',
              transform: [{ translateX: thumbTranslateX }],
            },
          ]}
        >
          {isDark ? (
            <Ionicons name="moon" size={22} color="#FFD166" />
          ) : (
            <Ionicons name="sunny" size={24} color="#FF8800" />
          )}
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
      b1.setValue(0.3);
      b2.setValue(0.3);
      b3.setValue(0.3);
      b4.setValue(0.3);
      return;
    }
    const makeBarLoop = (val: Animated.Value, d: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: d, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.25, duration: d, useNativeDriver: true }),
        ])
      );
    const l1 = makeBarLoop(b1, 320);
    const l2 = makeBarLoop(b2, 240);
    const l3 = makeBarLoop(b3, 390);
    const l4 = makeBarLoop(b4, 280);
    l1.start();
    l2.start();
    l3.start();
    l4.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
      l4.stop();
    };
  }, [active, b1, b2, b3, b4]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 16 }}>
      {[b1, b2, b3, b4].map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3,
            height: 14,
            borderRadius: 2,
            backgroundColor: active ? color : '#8E8E93',
            transform: [{ scaleY: bar }],
          }}
        />
      ))}
    </View>
  );
};

const getGeminiApiKey = () => {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
};

const realTranslate = async (text: string, fromLang: string, toLang: string) => {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`
    );
    const data = await res.json();
    return data.responseData?.translatedText || text;
  } catch (error) {
    return text;
  }
};

const fetchGeminiDynamicReplies = async (heardText: string, venueName: string) => {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return null;

    const prompt = `User is deaf/non-verbal at a counter: "${venueName}".
The clerk just said: "${heardText}".
Generate 2 to 3 concise 1-tap quick replies in Traditional Chinese (zh-TW) and English (en-US).
Return strictly JSON formatted as:
[
  { "zh": "不用，謝謝", "en": "No, thank you", "tts": "不用，謝謝" },
  { "zh": "好的，麻煩你", "en": "Yes, please", "tts": "好的，麻煩你" }
]`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await res.json();
    const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = rawReply.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    return null;
  }
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
  {
    id: 'cvs',
    baseType: 'cvs',
    name: { 'zh-TW': '便利商店', 'en-US': 'Convenience Store' },
    short: { 'zh-TW': '便利商店', 'en-US': '7-Eleven / CVS' },
    emoji: '🏪',
    coverImage: 'https://images.unsplash.com/photo-1601599561096-f87c95fff1e9?w=1200',
  },
  {
    id: 'drink',
    baseType: 'drink',
    name: { 'zh-TW': '咖啡・飲料店', 'en-US': 'Cafe & Drinks' },
    short: { 'zh-TW': '咖啡飲料', 'en-US': 'Cafe' },
    emoji: '🧋',
    coverImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200',
  },
  {
    id: 'breakfast',
    baseType: 'breakfast',
    name: { 'zh-TW': '早餐店', 'en-US': 'Breakfast Shop' },
    short: { 'zh-TW': '早餐店', 'en-US': 'Breakfast' },
    emoji: '🥪',
    coverImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1200',
  },
  {
    id: 'pharmacy',
    baseType: 'pharmacy',
    name: { 'zh-TW': '藥局・診所', 'en-US': 'Pharmacy & Clinic' },
    short: { 'zh-TW': '藥局診所', 'en-US': 'Pharmacy' },
    emoji: '💊',
    coverImage: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200',
  },
  {
    id: 'buffet',
    baseType: 'buffet',
    name: { 'zh-TW': '自助餐・便當', 'en-US': 'Bento & Buffet' },
    short: { 'zh-TW': '自助餐便當', 'en-US': 'Buffet' },
    emoji: '🍱',
    coverImage: 'https://images.unsplash.com/photo-1548943487-a2e4b43b5930?w=1200',
  },
  {
    id: 'university',
    baseType: 'university',
    name: { 'zh-TW': '校園・圖書館', 'en-US': 'Campus & Library' },
    short: { 'zh-TW': '校園圖書館', 'en-US': 'Campus' },
    emoji: '🏫',
    coverImage: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200',
  },
  {
    id: 'salon',
    baseType: 'salon',
    name: { 'zh-TW': '美髮店', 'en-US': 'Hair Salon' },
    short: { 'zh-TW': '美髮店', 'en-US': 'Salon' },
    emoji: '✂️',
    coverImage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200',
  },
  {
    id: 'other',
    baseType: 'other',
    name: { 'zh-TW': '一般商店', 'en-US': 'General Place' },
    short: { 'zh-TW': '一般商店', 'en-US': 'General' },
    emoji: '🏬',
    coverImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
  },
];

const DEFAULT_CARDS_DATA = [
  {
    id: 'temp_choice',
    stores: ['drink', 'cvs', 'breakfast'],
    priority: 1,
    question: { 'zh-TW': '冰的還是熱的？', 'en-US': 'Iced or Hot?' },
    keywords: ['冰的', '熱的', '溫的', '冰塊', 'iced', 'hot', 'warm'],
    options: [
      { labels: { 'zh-TW': '冰的', 'en-US': 'Iced' }, subLabels: { 'zh-TW': '冷飲', 'en-US': 'Cold drink' }, tts: '冰的' },
      { labels: { 'zh-TW': '熱的', 'en-US': 'Hot' }, subLabels: { 'zh-TW': '熱飲', 'en-US': 'Hot drink' }, tts: '熱的' },
      { labels: { 'zh-TW': '溫的', 'en-US': 'Warm' }, subLabels: { 'zh-TW': '溫飲', 'en-US': 'Warm drink' }, tts: '溫的' },
    ],
  },
  {
    id: 'icelevel',
    stores: ['drink'],
    priority: 1,
    question: { 'zh-TW': '冰塊要多少？', 'en-US': 'How much ice?' },
    keywords: ['冰塊', '正常冰', '少冰', '微冰', '去冰', '完全去冰', 'ice'],
    options: [
      { labels: { 'zh-TW': '正常冰', 'en-US': 'Regular Ice' }, subLabels: { 'zh-TW': '標準冰量', 'en-US': 'Normal ice' }, tts: '正常冰' },
      { labels: { 'zh-TW': '少冰', 'en-US': 'Less Ice' }, subLabels: { 'zh-TW': '7分冰', 'en-US': '70% ice' }, tts: '少冰' },
      { labels: { 'zh-TW': '微冰', 'en-US': 'Light Ice' }, subLabels: { 'zh-TW': '3分冰', 'en-US': '30% ice' }, tts: '微冰' },
      { labels: { 'zh-TW': '去冰', 'en-US': 'No Ice' }, subLabels: { 'zh-TW': '不要冰塊', 'en-US': 'Zero ice' }, tts: '去冰' },
    ],
  },
  {
    id: 'sugar',
    stores: ['drink'],
    priority: 1,
    question: { 'zh-TW': '甜度？', 'en-US': 'Sweetness level?' },
    keywords: ['糖', '甜度', '甜', '半糖', '微糖', '無糖', '少糖', '全糖', 'sugar', 'sweet'],
    options: [
      { labels: { 'zh-TW': '無糖', 'en-US': 'No Sugar' }, subLabels: { 'zh-TW': '0% 甜度', 'en-US': '0% sugar' }, tts: '無糖' },
      { labels: { 'zh-TW': '微糖', 'en-US': 'Light Sugar' }, subLabels: { 'zh-TW': '3分甜', 'en-US': '30% sugar' }, tts: '微糖' },
      { labels: { 'zh-TW': '半糖', 'en-US': 'Half Sugar' }, subLabels: { 'zh-TW': '5分甜', 'en-US': '50% sugar' }, tts: '半糖' },
      { labels: { 'zh-TW': '正常甜', 'en-US': 'Regular Sugar' }, subLabels: { 'zh-TW': '標準甜度', 'en-US': '100% sugar' }, tts: '正常甜' },
    ],
  },
  {
    id: 'cup_size',
    stores: ['drink', 'cvs', 'breakfast'],
    priority: 1,
    question: { 'zh-TW': '大杯還是中杯？', 'en-US': 'Large or Medium cup?' },
    keywords: ['大杯', '中杯', '小杯', '特大杯', '尺寸', 'size', 'large', 'medium'],
    options: [
      { labels: { 'zh-TW': '大杯', 'en-US': 'Large' }, subLabels: { 'zh-TW': '大杯容量', 'en-US': 'Large cup' }, tts: '大杯' },
      { labels: { 'zh-TW': '中杯', 'en-US': 'Medium' }, subLabels: { 'zh-TW': '中杯容量', 'en-US': 'Medium cup' }, tts: '中杯' },
    ],
  },
  {
    id: 'toppings',
    stores: ['drink'],
    priority: 1,
    question: { 'zh-TW': '要加料嗎？', 'en-US': 'Any toppings?' },
    keywords: ['加料', '珍珠', '波霸', '椰果', '仙草', '布丁', 'topping', 'boba', 'pearl'],
    options: [
      { labels: { 'zh-TW': '不用加料', 'en-US': 'No Toppings' }, subLabels: { 'zh-TW': '原味即可', 'en-US': 'Plain drink' }, tts: '不用加料' },
      { labels: { 'zh-TW': '加珍珠', 'en-US': 'Add Boba / Pearls' }, subLabels: { 'zh-TW': '波霸/珍珠', 'en-US': 'Tapioca pearls' }, tts: '加珍珠' },
      { labels: { 'zh-TW': '加椰果', 'en-US': 'Add Coconut Jelly' }, subLabels: { 'zh-TW': '椰果配料', 'en-US': 'Nata de coco' }, tts: '加椰果' },
    ],
  },
  {
    id: 'second_cup',
    stores: ['drink', 'cvs'],
    priority: 1,
    question: { 'zh-TW': '第二杯半價要嗎？', 'en-US': '2nd cup half price?' },
    keywords: ['第二杯', '半價', '兩杯', '優惠', '寄杯', 'second cup', 'discount'],
    options: [
      { labels: { 'zh-TW': '不用，一杯就好', 'en-US': 'No, just one' }, subLabels: { 'zh-TW': '買一杯即可', 'en-US': 'Single cup only' }, tts: '不用' },
      { labels: { 'zh-TW': '好，我要兩杯', 'en-US': 'Yes, two cups' }, subLabels: { 'zh-TW': '搭配優惠', 'en-US': 'Take the deal' }, tts: '要兩杯' },
    ],
  },
  {
    id: 'heat',
    stores: ['cvs', 'breakfast'],
    priority: 1,
    question: { 'zh-TW': '要加熱嗎？', 'en-US': 'Heat it up?' },
    keywords: ['加熱', '微波', '熱一下', '要熱嗎', '烤一下', 'heat', 'microwave', 'warm up'],
    options: [
      { labels: { 'zh-TW': '要加熱', 'en-US': 'Yes, heat it up' }, subLabels: { 'zh-TW': '請幫我微波加熱', 'en-US': 'Microwave please' }, tts: '要加熱' },
      { labels: { 'zh-TW': '不用加熱', 'en-US': 'No need' }, subLabels: { 'zh-TW': '直接拿走', 'en-US': 'Keep as is' }, tts: '不用加熱' },
    ],
  },
  {
    id: 'rice',
    stores: ['buffet'],
    priority: 1,
    question: { 'zh-TW': '白飯要多少？', 'en-US': 'How much rice?' },
    keywords: ['白飯', '飯要', '半碗', '飯量', '紫米', 'rice'],
    options: [
      { labels: { 'zh-TW': '正常飯', 'en-US': 'Normal Rice' }, subLabels: { 'zh-TW': '標準飯量', 'en-US': 'Standard portion' }, tts: '正常飯' },
      { labels: { 'zh-TW': '少飯', 'en-US': 'Less Rice' }, subLabels: { 'zh-TW': '半碗飯', 'en-US': 'Half portion' }, tts: '少飯' },
      { labels: { 'zh-TW': '不要飯', 'en-US': 'No Rice' }, subLabels: { 'zh-TW': '只要菜', 'en-US': 'Dishes only' }, tts: '不要飯' },
    ],
  },
  {
    id: 'campus_inquire',
    stores: ['university'],
    priority: 1,
    question: { 'zh-TW': '請問需要什麼協助？', 'en-US': 'How can I help you?' },
    keywords: ['學生證', '借書', '找哪位', '教室', 'library', 'id', 'card'],
    options: [
      { labels: { 'zh-TW': '借還書 / 查資料', 'en-US': 'Library Books' }, subLabels: { 'zh-TW': '圖書館櫃檯服務', 'en-US': 'Borrow/return books' }, tts: '您好，我需要借還書或查資料協助' },
      { labels: { 'zh-TW': '出示學生證', 'en-US': 'Show Student ID' }, subLabels: { 'zh-TW': '驗證身分', 'en-US': 'Verify student ID' }, tts: '這是我的學生證' },
    ],
  },
  {
    id: 'dinein',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '內用還是外帶？', 'en-US': 'For here or to go?' },
    keywords: ['內用', '外帶', '這裡吃', '帶走', 'to go', 'dine in', 'for here'],
    options: [
      { labels: { 'zh-TW': '內用', 'en-US': 'Dine In' }, subLabels: { 'zh-TW': '在店裡吃', 'en-US': 'Eat here' }, tts: '內用' },
      { labels: { 'zh-TW': '外帶', 'en-US': 'Takeout' }, subLabels: { 'zh-TW': '帶走', 'en-US': 'To go' }, tts: '外帶' },
    ],
  },
  {
    id: 'member',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '有集點或會員嗎？', 'en-US': 'Membership or points?' },
    keywords: ['會員', '集點', '電話', '號碼', '統編', 'member', 'points', 'phone'],
    options: [
      { labels: { 'zh-TW': '沒有會員', 'en-US': 'No Membership' }, subLabels: { 'zh-TW': '不用集點', 'en-US': 'Skip points' }, tts: '沒有會員' },
      { labels: { 'zh-TW': '有，掃條碼', 'en-US': 'Yes, scan barcode' }, subLabels: { 'zh-TW': '出示手機會員', 'en-US': 'Show member app' }, tts: '有會員，請幫我掃條碼', showBarcode: true },
      { labels: { 'zh-TW': '我打字輸入電話', 'en-US': 'Type Phone Number' }, subLabels: { 'zh-TW': '用鍵盤顯示電話', 'en-US': 'Show phone on screen' }, tts: '請看我螢幕上的電話號碼', kind: 'type' },
    ],
  },
  {
    id: 'carrier',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '有載具嗎？', 'en-US': 'Do you have a receipt carrier?' },
    keywords: ['載具', '條碼', '手機條碼', '雲端發票', 'carrier', 'barcode'],
    options: [
      { labels: { 'zh-TW': '手機條碼', 'en-US': 'Phone Barcode' }, subLabels: { 'zh-TW': '顯示載具條碼給店員掃', 'en-US': 'Show carrier barcode on top screen' }, tts: '有載具，請掃手機條碼', showBarcode: true },
      { labels: { 'zh-TW': '紙本發票', 'en-US': 'Paper Receipt' }, subLabels: { 'zh-TW': '直接印出來', 'en-US': 'Print paper receipt' }, tts: '沒有載具，請印紙本發票' },
      { labels: { 'zh-TW': '不用', 'en-US': 'No need' }, subLabels: { 'zh-TW': '不用載具', 'en-US': 'No carrier' }, tts: '不用載具' },
    ],
  },
  {
    id: 'receipt_print',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '發票要印嗎？', 'en-US': 'Print the receipt?' },
    keywords: ['發票', '要印嗎', '印發票', '明細', '統編', 'receipt', 'print'],
    options: [
      { labels: { 'zh-TW': '要印發票', 'en-US': 'Print Receipt' }, subLabels: { 'zh-TW': '紙本發票', 'en-US': 'Yes, print it' }, tts: '發票要印' },
      { labels: { 'zh-TW': '不用印，存載具', 'en-US': 'Save to Carrier' }, subLabels: { 'zh-TW': '顯示手機條碼', 'en-US': 'No print, scan barcode' }, tts: '發票不用印，請幫我存載具', showBarcode: true },
      { labels: { 'zh-TW': '捐發票 / 不用', 'en-US': 'Donate / No Need' }, subLabels: { 'zh-TW': '不拿紙本發票', 'en-US': 'No paper receipt' }, tts: '發票不用印' },
    ],
  },
  {
    id: 'bag',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '需要袋子嗎？', 'en-US': 'Do you need a bag?' },
    keywords: ['袋子', '提袋', '購物袋', '塑膠袋', 'bag', 'plastic bag'],
    options: [
      { labels: { 'zh-TW': '要袋子', 'en-US': 'Need a Bag' }, subLabels: { 'zh-TW': '加購購物袋', 'en-US': 'Buy a bag' }, tts: '要袋子' },
      { labels: { 'zh-TW': '不用袋子', 'en-US': 'No Bag' }, subLabels: { 'zh-TW': '自己拿或自備袋子', 'en-US': 'I have my own' }, tts: '不用袋子' },
    ],
  },
  {
    id: 'pay',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '請問怎麼付款？', 'en-US': 'How would you like to pay?' },
    keywords: ['現金', '刷卡', '付款', '支付', '悠遊卡', 'line pay', 'apple pay', 'cash', 'card', 'pay'],
    options: [
      { labels: { 'zh-TW': '付現', 'en-US': 'Cash' }, subLabels: { 'zh-TW': '現金付款', 'en-US': 'Pay with cash' }, tts: '付現' },
      { labels: { 'zh-TW': '刷卡 / 行動支付', 'en-US': 'Card / Mobile Pay' }, subLabels: { 'zh-TW': 'Apple Pay / Line Pay', 'en-US': 'Contactless payment' }, tts: '刷卡' },
      { labels: { 'zh-TW': '悠遊卡', 'en-US': 'EasyCard' }, subLabels: { 'zh-TW': '感應悠遊卡', 'en-US': 'Tap EasyCard' }, tts: '悠遊卡' },
    ],
  },
];

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'] as const;

const BARCODE_WEIGHTS = [
  3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 3,
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

  // Active Interactive Card / Amount Confirmation
  const [activePromptCard, setActivePromptCard] = useState<any>(null);
  const [chosenOption, setChosenOption] = useState<any>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [amountConfirmed, setAmountConfirmed] = useState<boolean | undefined>(undefined);

  // 180° Offline Clerk Pick Modal States
  const [isClerkPickOpen, setIsClerkPickOpen] = useState(false);
  const [clerkPickView, setClerkPickView] = useState<'grid' | 'amount'>('grid');
  const [clerkDigits, setClerkDigits] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [comboItems, setComboItems] = useState<string[]>([]);
  const [watchNumber, setWatchNumber] = useState('');
  const [isNumberModalOpen, setIsNumberModalOpen] = useState(false);
  const [numberCalledAlert, setNumberCalledAlert] = useState(false);
  const [isTypeToClerkOpen, setIsTypeToClerkOpen] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState('');

  // Custom Add Q&A Modal States
  const [isAddQaOpen, setIsAddQaOpen] = useState(false);
  const [newQuestionInput, setNewQuestionInput] = useState('');
  const [newAnswerInput, setNewAnswerInput] = useState('');
  const [saveToastMsg, setSaveToastMsg] = useState('');

  // GPS Detection & Editable Situation Creator States
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [nearbyVenueFound, setNearbyVenueFound] = useState<any>(null);
  const [editablePlaceName, setEditablePlaceName] = useState('');
  const [selectedBaseType, setSelectedBaseType] = useState('cvs');
  const [detectedCandidates, setDetectedCandidates] = useState<
    Array<{ label: string; type: string; isPoi?: boolean }>
  >([]);

  // Live Speech Recognition States
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStreamText, setLiveStreamText] = useState('');
  const [lastHeardQuestion, setLastHeardQuestion] = useState('');
  const [smartReplies, setSmartReplies] = useState<any[]>([]);

  const webRecRef = useRef<any>(null);

  const triggerHaptic = (pattern: number | number[] = 60) => {
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(pattern);
      } catch (e) {}
    }
  };

  // ☁️ PUSH UPDATES TO RENDER CLOUD BACKEND
  const pushToCloud = async (payload: {
    venues?: any[];
    cards?: any[];
    wallpapers?: Record<string, string>;
    carrierCode?: string;
  }) => {
    try {
      const res = await fetch(CLOUD_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) setCloudSynced(true);
    } catch (e) {}
  };

  // ☁️ PULL LATEST STATE FROM RENDER CLOUD BACKEND
  const pullFromCloud = async () => {
    try {
      const res = await fetch(CLOUD_SYNC_URL);
      if (!res.ok) return;
      const data = await res.json();
      setCloudSynced(true);

      if (Array.isArray(data?.venues) && data.venues.length > 0) {
        setVenues(data.venues);
        setActiveVenue((prev) => data.venues.find((v: any) => v.id === prev.id) || data.venues[0]);
        if (Platform.OS === 'web') {
          localStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify(data.venues));
        } else {
          await AsyncStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify(data.venues));
        }
      }
      if (Array.isArray(data?.cards) && data.cards.length > 0) {
        setCardsData(sanitizeCardsList(data.cards));
        if (Platform.OS === 'web') {
          localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(data.cards));
        } else {
          await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(data.cards));
        }
      }
      if (data?.wallpapers && Object.keys(data.wallpapers).length > 0) {
        setCustomWallpapers((prev) => {
          const merged = { ...prev, ...data.wallpapers };
          if (Platform.OS === 'web') {
            localStorage.setItem(STORAGE_KEYS.WALLPAPERS, JSON.stringify(merged));
          } else {
            AsyncStorage.setItem(STORAGE_KEYS.WALLPAPERS, JSON.stringify(merged));
          }
          return merged;
        });
      }
      if (data?.carrierCode) {
        setCarrierCode(data.carrierCode);
      }
    } catch (e) {}
  };

  // 💾 PERSISTENCE STORAGE LOADER + CLOUD SYNC POLLING
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const getItem = async (key: string) =>
          Platform.OS === 'web' ? localStorage.getItem(key) : await AsyncStorage.getItem(key);

        const savedVenues = await getItem(STORAGE_KEYS.VENUES);
        const savedCards = await getItem(STORAGE_KEYS.CARDS);
        const savedWallpapers = await getItem(STORAGE_KEYS.WALLPAPERS);
        const savedScale = await getItem(STORAGE_KEYS.FONT_SCALE);
        const savedTheme = await getItem(STORAGE_KEYS.THEME_MODE);
        const savedCarrier = await getItem(STORAGE_KEYS.CARRIER_CODE);

        if (savedVenues) {
          const parsed = JSON.parse(savedVenues);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setVenues(parsed);
            setActiveVenue(parsed[0]);
          }
        }
        if (savedCards) {
          const parsed = JSON.parse(savedCards);
          if (Array.isArray(parsed) && parsed.length > 0) setCardsData(sanitizeCardsList(parsed));
        }
        if (savedWallpapers) {
          setCustomWallpapers(JSON.parse(savedWallpapers));
        }
        if (savedScale) {
          const numScale = parseFloat(savedScale);
          if (!isNaN(numScale) && numScale >= 0.8 && numScale <= 1.8) {
            setFontScale(numScale);
          }
        }
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeMode(savedTheme);
        }
        if (savedCarrier) {
          setCarrierCode(savedCarrier);
        }
      } catch (e) {
        console.error('Error loading stored configurations:', e);
      }

      await pullFromCloud();
    };

    loadSavedData();
    const syncTimer = setInterval(pullFromCloud, 12000);
    return () => clearInterval(syncTimer);
  }, []);

  const showToast = (msg: string) => {
    setSaveToastMsg(msg);
    setTimeout(() => {
      setSaveToastMsg('');
    }, 3500);
  };

  const toggleThemeMode = async () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEYS.THEME_MODE, next);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, next);
      }
    } catch (e) {}
  };

  const persistCarrierCode = async (code: string) => {
    const formatted = code.trim().startsWith('/')
      ? code.trim().toUpperCase()
      : `/${code.trim().toUpperCase()}`;
    setCarrierCode(formatted);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEYS.CARRIER_CODE, formatted);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.CARRIER_CODE, formatted);
      }
    } catch (e) {}
    pushToCloud({ carrierCode: formatted });
  };

  const persistFontScale = async (val: number) => {
    setFontScale(val);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEYS.FONT_SCALE, String(val));
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.FONT_SCALE, String(val));
      }
    } catch (e) {}
  };

  const persistVenues = async (updated: any[]) => {
    setVenues(updated);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify(updated));
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify(updated));
      }
    } catch (e) {}
    pushToCloud({ venues: updated });
  };

  const persistCards = async (updated: any[]) => {
    setCardsData(updated);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(updated));
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(updated));
      }
    } catch (e) {}
    pushToCloud({ cards: updated });
  };

  // 🗑️ DELETE ANY SITUATION (Inside Settings -> Manage Situations)
  const handleDeleteVenue = async (venueId: string) => {
    if (venues.length <= 1) {
      Alert.alert(
        currentLang === 'zh-TW' ? '無法刪除' : 'Cannot Delete',
        currentLang === 'zh-TW'
          ? '請至少保留一個場景。'
          : 'Please keep at least one situation.'
      );
      return;
    }
    const target = venues.find((v) => v.id === venueId);
    const updated = venues.filter((v) => v.id !== venueId);
    await persistVenues(updated);
    if (activeVenue.id === venueId) {
      setActiveVenue(updated[0]);
    }
    showToast(
      currentLang === 'zh-TW'
        ? `已刪除「${target?.name?.['zh-TW'] || ''}」`
        : `Deleted "${target?.name?.['en-US'] || ''}"`
    );
  };

  // 🗑️ DELETE LEARNED / CUSTOM Q&A CARD
  const handleDeleteCard = async (cardId: string) => {
    const updated = cardsData.filter((c) => c.id !== cardId);
    await persistCards(updated);
    if (activePromptCard?.id === cardId) {
      resetStageToIdle();
    }
    showToast(currentLang === 'zh-TW' ? '已刪除此問題與回答' : 'Deleted custom Q&A');
  };

  // 🖼️ SAVE WALLPAPER LOCALLY + SYNC TO CLOUD FOR ALL DEVICES
  const saveCustomWallpaper = async () => {
    if (!wallpaperInputUrl.trim()) return;
    const newUrl = wallpaperInputUrl.trim();
    const newWallpapers = { ...customWallpapers, [activeVenue.id]: newUrl };
    setCustomWallpapers(newWallpapers);

    const updatedVenues = venues.map((v) =>
      v.id === activeVenue.id ? { ...v, coverImage: newUrl } : v
    );
    setVenues(updatedVenues);
    setActiveVenue((prev) => ({ ...prev, coverImage: newUrl }));

    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEYS.WALLPAPERS, JSON.stringify(newWallpapers));
        localStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify(updatedVenues));
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.WALLPAPERS, JSON.stringify(newWallpapers));
        await AsyncStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify(updatedVenues));
      }
    } catch (e) {}

    await pushToCloud({ wallpapers: newWallpapers, venues: updatedVenues });
    setWallpaperInputUrl('');
    showToast(
      currentLang === 'zh-TW'
        ? '✓ 封面圖片已更新並同步至所有裝置！'
        : '✓ Wallpaper updated & synced across all devices!'
    );
  };

  const getActiveCoverImage = () => customWallpapers[activeVenue.id] || activeVenue.coverImage;

  const getVenueShortName = (v: any) => {
    if (!v) return '';
    if (typeof v.short === 'object') return v.short[currentLang] || v.short['zh-TW'];
    return v.short;
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
        playTone(659.25, 0, 0.22); // E5
        playTone(880.0, 0.18, 0.38); // A5
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
          // Refresh mic stream right after TTS finishes so it is 100% ready for clerk's next reply
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
                const targetLocale = isTranslateMode
                  ? currentLang === 'en-US'
                    ? 'zh-TW'
                    : 'en-US'
                  : currentLang;
                NativeSpeechModule.start({
                  lang: targetLocale,
                  interimResults: true,
                  continuous: true,
                });
              } catch (e) {}
            }
          },
        });
      }, 150);
    }
  };

  // 🧠 SMART LEARNING ENGINE
  const learnNewConversationExchange = async (promptHeard: string, userReplyText: string) => {
    const cleanQ = (promptHeard || '').replace(/\.\.\.$/, '').trim();
    const cleanA = (userReplyText || '').trim();
    if (!cleanQ || !cleanA || cleanQ.length < 2) return;
    if (
      cleanQ.includes('請開始說話') ||
      cleanQ.includes('Listening') ||
      cleanQ === cleanA
    ) {
      return;
    }

    let enAnswer = cleanA;
    let enQuestion = cleanQ;
    if (/[\u4e00-\u9fa5]/.test(cleanA)) {
      enAnswer = await realTranslate(cleanA, 'zh-TW', 'en-US');
    }
    if (/[\u4e00-\u9fa5]/.test(cleanQ)) {
      enQuestion = await realTranslate(cleanQ, 'zh-TW', 'en-US');
    }

    const cleanKeywords = [cleanQ.toLowerCase()];
    const stripped = cleanQ.replace(/[？?！!，,。、\s]/g, '');
    if (stripped.length >= 2 && !cleanKeywords.includes(stripped.toLowerCase())) {
      cleanKeywords.push(stripped.toLowerCase());
    }

    const existingIndex = cardsData.findIndex(
      (c) =>
        (c.stores.includes(activeVenue.id) ||
          (activeVenue.baseType && c.stores.includes(activeVenue.baseType)) ||
          c.stores.includes('*')) &&
        (c.question?.['zh-TW'] === cleanQ ||
          c.keywords.some(
            (k: string) =>
              cleanQ.toLowerCase().includes(k.toLowerCase()) ||
              k.toLowerCase().includes(cleanQ.toLowerCase())
          ))
    );

    const newOption = {
      labels: { 'zh-TW': cleanA, 'en-US': enAnswer || cleanA },
      subLabels: { 'zh-TW': '✨ 已記憶回答', 'en-US': '✨ Saved reply' },
      tts: cleanA,
    };

    if (existingIndex !== -1) {
      const targetCard = { ...cardsData[existingIndex] };
      const alreadyHasOption = targetCard.options.some(
        (o: any) =>
          o.labels['zh-TW'] === cleanA ||
          o.labels['en-US']?.toLowerCase() === cleanA.toLowerCase()
      );
      if (!alreadyHasOption) {
        targetCard.options = [newOption, ...targetCard.options];
        if (!targetCard.stores.includes(activeVenue.id)) {
          targetCard.stores = [activeVenue.id, ...targetCard.stores];
        }
        const updated = [...cardsData];
        updated[existingIndex] = targetCard;
        await persistCards(updated);
        showToast(`✨ 已為「${cleanQ}」新增常選回答：「${cleanA}」`);
      }
      return;
    }

    const newCard = {
      id: `learned_${Date.now()}`,
      isCustom: true,
      stores: [activeVenue.id, ...(activeVenue.baseType ? [activeVenue.baseType] : [])],
      priority: 0,
      question: { 'zh-TW': cleanQ, 'en-US': enQuestion || cleanQ },
      keywords: cleanKeywords,
      options: [newOption],
    };

    const updated = [newCard, ...cardsData];
    await persistCards(updated);
    showToast(`✨ 已記憶新問題「${cleanQ}」→ 下次將自動建議「${cleanA}」`);
  };

  const handleManualSaveQA = async () => {
    if (!newQuestionInput.trim() || !newAnswerInput.trim()) {
      Alert.alert('請輸入完整內容', '請輸入店員的問題以及您的回答。');
      return;
    }
    await learnNewConversationExchange(newQuestionInput.trim(), newAnswerInput.trim());
    setNewQuestionInput('');
    setNewAnswerInput('');
    setIsAddQaOpen(false);
  };

  const processRecognizedText = async (rawText: string, isFinal: boolean) => {
    if (!rawText.trim()) return;

    let translated = '';
    if (isTranslateMode) {
      setLiveStreamText(rawText + (isFinal ? '' : ' ...'));
      if (isFinal) {
        const targetLang = currentLang;
        const sourceLang = currentLang === 'en-US' ? 'zh-TW' : 'en-US';
        translated = await realTranslate(rawText, sourceLang, targetLang);
        setLiveStreamText(translated);
      }
    } else {
      setLiveStreamText(rawText);
    }

    if (
      !rawText.includes('請開始說話') &&
      !rawText.includes('Listening') &&
      rawText.trim().length >= 2
    ) {
      setLastHeardQuestion(rawText.trim());
    }

        const lowerRaw = rawText.toLowerCase();
    if (watchNumber && rawText.includes(watchNumber)) {
      setNumberCalledAlert(true);
      triggerHaptic([0, 150, 80, 150, 80, 200]);
    }
    const lowerTrans = translated.toLowerCase();

    const currentVenueCards = cardsData.filter(
      (c) =>
        c.stores.includes(activeVenue.id) ||
        (activeVenue.baseType && c.stores.includes(activeVenue.baseType)) ||
        c.stores.includes('*')
    );

    const triggeredReplies: any[] = [];
    let matchedCard: any = null;

    currentVenueCards.forEach((card) => {
      if (
        card.keywords.some(
          (kw: string) =>
            lowerRaw.includes(kw.toLowerCase()) ||
            kw.toLowerCase().includes(lowerRaw) ||
            (translated && lowerTrans.includes(kw.toLowerCase()))
        )
      ) {
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

    if (triggeredReplies.length === 0 && isFinal && rawText.length > 1) {
      const dynamicAiReplies = await fetchGeminiDynamicReplies(
        rawText,
        activeVenue.name['zh-TW'] || getVenueShortName(activeVenue)
      );
      if (dynamicAiReplies && Array.isArray(dynamicAiReplies)) {
        triggerHaptic([0, 40, 60, 40]);
        dynamicAiReplies.forEach((r, idx) => {
          triggeredReplies.push({
            id: `gemini_auto_${idx}`,
            text: currentLang === 'en-US' ? r.en : r.zh,
            clerkText: r.tts || r.zh,
          });
        });
      }
    }

    if (triggeredReplies.length > 0) {
      setSmartReplies(triggeredReplies);
    }
  };

  // 🎙️ NATIVE SPEECH EVENT LISTENERS
  useEffect(() => {
    if (Platform.OS === 'web' || !NativeSpeechModule) return;

    const subStart = attachNativeSpeechEvent('start', () => {
      setIsLiveActive(true);
    });

    const subEnd = attachNativeSpeechEvent('end', () => {
      if (isLiveActive) {
        setTimeout(() => {
          try {
            const targetLocale = isTranslateMode
              ? currentLang === 'en-US'
                ? 'zh-TW'
                : 'en-US'
              : currentLang;
            NativeSpeechModule.start({
              lang: targetLocale,
              interimResults: true,
              continuous: true,
            });
          } catch (e) {}
        }, 250);
      }
    });

    const subResult = attachNativeSpeechEvent('result', (event: any) => {
      const transcript = event?.results?.[0]?.transcript || event?.value?.[0] || '';
      const isFinal = Boolean(event?.isFinal);
      if (transcript) {
        processRecognizedText(transcript, isFinal);
      }
    });

    const subError = attachNativeSpeechEvent('error', (event: any) => {
      if (
        isLiveActive &&
        (event?.error === 'no-speech' || event?.error === '7' || event?.error === 'client')
      ) {
        setTimeout(() => {
          try {
            const targetLocale = isTranslateMode
              ? currentLang === 'en-US'
                ? 'zh-TW'
                : 'en-US'
              : currentLang;
            NativeSpeechModule.start({
              lang: targetLocale,
              interimResults: true,
              continuous: true,
            });
          } catch (e) {}
        }, 400);
      }
    });

    return () => {
      subStart?.remove?.();
      subEnd?.remove?.();
      subResult?.remove?.();
      subError?.remove?.();
    };
  }, [isLiveActive, currentLang, isTranslateMode]);  const processRecognizedRef = useRef<any>(null);
  processRecognizedRef.current = processRecognizedText;
  const isLiveActiveRef = useRef(false);
  isLiveActiveRef.current = isLiveActive;
  const watchdogTimerRef = useRef<any>(null);
  const lastTranscriptTimeRef = useRef<number>(Date.now());

  // 🌐 SELF-HEALING ZERO-HANG WEB SPEECH ENGINE (Fresh instance per utterance + Watchdog)
  const startFreshWebRecognizer = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec || !isLiveActiveRef.current) return;

    // Cleanly tear down any previous zombie instance
    if (webRecRef.current) {
      try {
        webRecRef.current.onresult = null;
        webRecRef.current.onend = null;
        webRecRef.current.onerror = null;
        webRecRef.current.abort();
      } catch (e) {}
    }

    try {
      const rec = new SpeechRec();
      // continuous = true with automatic watchdog recycling prevents buffer freeze
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = isTranslateMode ? (currentLang === 'en-US' ? 'zh-TW' : 'en-US') : currentLang;

      rec.onresult = (event: any) => {
        lastTranscriptTimeRef.current = Date.now();
        let latestInterim = '';
        let latestFinal = '';

        // Always read the newest result index so old buffer items never block new speech
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            latestFinal += piece;
          } else {
            latestInterim += piece;
          }
        }

        const activeText = (latestFinal || latestInterim).trim();
        if (activeText) {
          setLiveStreamText(activeText);
          processRecognizedRef.current?.(activeText, Boolean(latestFinal));
        }

        // If the browser accumulated more than 6 results in one session, recycle cleanly so it never lags
        if (event.results.length > 6 && Boolean(latestFinal)) {
          try {
            rec.stop();
          } catch (e) {}
        }
      };

      rec.onerror = (e: any) => {
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          setIsLiveActive(false);
          isLiveActiveRef.current = false;
          return;
        }
        // On no-speech, network, or audio-capture glitch, recycle immediately
        if (isLiveActiveRef.current) {
          setTimeout(() => startFreshWebRecognizer(), 150);
        }
      };

      rec.onend = () => {
        if (isLiveActiveRef.current) {
          setTimeout(() => startFreshWebRecognizer(), 60);
        }
      };

      webRecRef.current = rec;
      lastTranscriptTimeRef.current = Date.now();
      rec.start();
    } catch (err) {
      if (isLiveActiveRef.current) {
        setTimeout(() => startFreshWebRecognizer(), 300);
      }
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (isLiveActive) {
        startFreshWebRecognizer();

        // Watchdog: If mic session hangs silently for >8 seconds without firing onend, force a fresh instance
        if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
        watchdogTimerRef.current = setInterval(() => {
          if (
            isLiveActiveRef.current &&
            Date.now() - lastTranscriptTimeRef.current > 8000
          ) {
            lastTranscriptTimeRef.current = Date.now();
            startFreshWebRecognizer();
          }
        }, 3000);
      } else {
        if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
        if (webRecRef.current) {
          try {
            webRecRef.current.onend = null;
            webRecRef.current.abort();
          } catch (e) {}
        }
      }

      return () => {
        if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
        if (webRecRef.current) {
          try {
            webRecRef.current.onend = null;
            webRecRef.current.abort();
          } catch (e) {}
        }
      };
    }
  }, [isLiveActive, currentLang, isTranslateMode]);

  const toggleLiveListening = async () => {
    const nextState = !isLiveActive;

    if (nextState) {
      const targetLocale = isTranslateMode
        ? currentLang === 'en-US'
          ? 'zh-TW'
          : 'en-US'
        : currentLang;

      if (Platform.OS !== 'web') {
        if (!NativeSpeechModule) {
          Alert.alert('語音辨識未啟用', '請使用下方或店員點選模式 (Offline Mode)。');
          return;
        }
        try {
          const perm = await NativeSpeechModule.requestPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('需要麥克風權限', '請允許麥克風權限以啟用即時字幕。');
            return;
          }
          setIsLiveActive(true);
          setLiveStreamText(currentLang === 'zh-TW' ? '請開始說話...' : 'Listening for speech...');
          await NativeSpeechModule.start({
            lang: targetLocale,
            interimResults: true,
            continuous: true,
          });
        } catch (e: any) {
          Alert.alert('語音啟動失敗', e?.message || '請確認手機已啟用 Google 語音服務。');
          setIsLiveActive(false);
        }
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
        try {
          await NativeSpeechModule?.stop();
        } catch (e) {}
      } else {
        try {
          webRecRef.current?.abort?.();
        } catch (e) {}
      }
      setLiveStreamText('');
      setSmartReplies([]);
    }
  };

  // 🎯 STAGE & CLERK DISPLAY HANDLERS
  const openCardStage = (card: any) => {
    const qText = card.question?.[currentLang] || card.question?.['zh-TW'] || '';
    setPendingAmount(null);
    setAmountConfirmed(undefined);
    setShowClerkBarcode(false);
    setActivePromptCard(card);
    setChosenOption(null);
    setClerkLabel(currentLang === 'zh-TW' ? '我正在看您的問題' : 'Reading your question');
    setClerkMessage(card.question?.['zh-TW'] || qText);
    setClerkSub(currentLang === 'zh-TW' ? '請稍等，我選一下' : 'One moment, choosing an answer');
  };

  const handleClerkPickCard = (card: any) => {
    setIsClerkPickOpen(false);
    setClerkPickView('grid');
    setClerkDigits('');
    triggerHaptic([0, 40, 60, 40]);
    openCardStage(card);
  };

  const handleClerkSubmitAmount = (val: number) => {
    setIsClerkPickOpen(false);
    setClerkPickView('grid');
    setClerkDigits('');
    setActivePromptCard(null);
    setChosenOption(null);
    setShowClerkBarcode(false);
    setPendingAmount(val);
    setAmountConfirmed(undefined);
    triggerHaptic([0, 40, 60, 40]);
    setClerkLabel(currentLang === 'zh-TW' ? '您輸入的金額' : 'Entered Amount');
    setClerkMessage(`NT$ ${val.toLocaleString('zh-TW')} 元`);
    setClerkSub(currentLang === 'zh-TW' ? '等待客人確認中...' : 'Waiting for confirmation...');
  };

  const handleConfirmAmount = (ok: boolean) => {
    triggerHaptic(80);
    setAmountConfirmed(ok);
    if (ok && pendingAmount !== null) {
      const msg = `✓ NT$ ${pendingAmount.toLocaleString('zh-TW')} 元`;
      setClerkLabel(currentLang === 'zh-TW' ? '金額已確認' : 'Amount Confirmed');
      setClerkMessage(msg);
      setClerkSub(currentLang === 'zh-TW' ? '謝謝，現在付款' : 'Thank you, paying now');
      speakSentence(`好的，${pendingAmount}元`, 'zh-TW');
    } else {
      const msg = '金額好像不對，請再按一次';
      setClerkLabel(currentLang === 'zh-TW' ? '金額確認' : 'Check Amount');
      setClerkMessage(msg);
      setClerkSub(currentLang === 'zh-TW' ? '請點右上角重新輸入金額' : 'Please re-enter the amount');
      speakSentence(msg, 'zh-TW');
    }
  };

  const handleSelectOption = (reply: any, optObj?: any) => {
    const displayToClerk = (optObj?.labels?.['zh-TW'] || reply.clerkText || reply.text || '').replace(/，?謝謝/g, '').trim();
    if (optObj?.kind === 'type') {
      setIsTypeToClerkOpen(true);
      return;
    }

    triggerHaptic(80);
    const shouldShowBarcode =
      Boolean(optObj?.showBarcode) ||
      /手機條碼|載具|掃條碼/.test(displayToClerk) ||
      /手機條碼|Phone Barcode/.test(reply.text || '');

    setShowClerkBarcode(shouldShowBarcode);
        setChosenOption(optObj || reply);
    if (displayToClerk && displayToClerk.length <= 8 && !shouldShowBarcode) {
      setComboItems((prev) => (prev.includes(displayToClerk) ? prev : [...prev.slice(-4), displayToClerk]));
    }
    setClerkLabel(
      shouldShowBarcode
        ? currentLang === 'zh-TW'
          ? '請掃描手機載具條碼'
          : 'Please Scan E-Invoice Carrier'
        : currentLang === 'zh-TW'
        ? '我的回答'
        : 'My Answer'
    );
    setClerkMessage(displayToClerk);
    setClerkSub(
      shouldShowBarcode
        ? `載具號碼：${carrierCode}`
        : currentLang === 'zh-TW'
        ? '請直接對手機說話，或點選問題'
        : 'Speak to phone or tap a question'
    );
    speakSentence(displayToClerk, 'zh-TW');
    setSmartReplies([]);

    const questionContext = lastHeardQuestion || liveStreamText;
    if (
      questionContext &&
      questionContext.length >= 2 &&
      !questionContext.includes('請開始說話') &&
      !questionContext.includes('Listening')
    ) {
      learnNewConversationExchange(questionContext, displayToClerk);
      setLastHeardQuestion('');
    }
  };

  const resetStageToIdle = () => {
    setActivePromptCard(null);
    setChosenOption(null);
    setPendingAmount(null);
    setAmountConfirmed(undefined);
    setShowClerkBarcode(false);
    setClerkLabel('');
    setClerkMessage('');
    setClerkSub('');
  };

  const pressKeypadDigit = (k: string) => {
    setClerkDigits((prev) => {
      if (k === 'clear') return '';
      if (k === 'del') return prev.slice(0, -1);
      if (prev.length >= 6) return prev;
      if (prev === '' && k === '0') return '';
      return prev + k;
    });
  };

  const inferCategoryType = (nameStr: string, osmTag: string = '') => {
    if (
      osmTag === 'convenience' ||
      osmTag === 'supermarket' ||
      /7-ELEVEN|7-11|全家|FamilyMart|萊爾富|OK超商|全聯|家樂福|美廉社|Costco|好市多/i.test(nameStr)
    ) {
      return 'cvs';
    }
    if (
      osmTag === 'cafe' ||
      osmTag === 'beverages' ||
      /星巴克|Starbucks|路易莎|Louisa|咖啡|茶|50嵐|迷客夏|清心|得正|可不可|麻古|鶴茶樓|再睡5分鐘|CoCo|一沐日|龜記/i.test(nameStr)
    ) {
      return 'drink';
    }
    if (/早餐|美而美|麥味登|拉亞|早安|永和豆漿|弘爺|瑞麟|早午餐/i.test(nameStr)) {
      return 'breakfast';
    }
    if (
      osmTag === 'pharmacy' ||
      osmTag === 'hospital' ||
      osmTag === 'clinic' ||
      osmTag === 'dentist' ||
      /藥局|診所|牙醫|醫院|屈臣氏|康是美|大樹藥局|丁丁|Satudora/i.test(nameStr)
    ) {
      return 'pharmacy';
    }
    if (
      osmTag === 'restaurant' ||
      osmTag === 'fast_food' ||
      /便當|自助餐|食堂|餐廳|小吃|麵|火鍋|八方雲集|四海遊龍|麥當勞|肯德基|摩斯/i.test(nameStr)
    ) {
      return 'buffet';
    }
    if (
      osmTag === 'university' ||
      osmTag === 'college' ||
      osmTag === 'library' ||
      osmTag === 'school' ||
      /大學|學院|圖書館|校區|系館|館|宿舍|University|College|Library/i.test(nameStr)
    ) {
      return 'university';
    }
    return 'other';
  };

  // 🎯 MULTI-SAMPLE HIGH-PRECISION GPS ACQUISITION
  const acquireBestGpsFix = async (): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
  }> => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve, reject) => {
        let bestPos: any = null;
        let watchId: any = null;

        const finish = () => {
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          if (bestPos) {
            resolve({
              latitude: bestPos.coords.latitude,
              longitude: bestPos.coords.longitude,
              accuracy: Math.round(bestPos.coords.accuracy || 50),
            });
          } else {
            reject(new Error('WEB_GPS_TIMEOUT'));
          }
        };

        const timer = setTimeout(finish, 3800);

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
              bestPos = pos;
            }
            if (pos.coords.accuracy <= 12) {
              clearTimeout(timer);
              finish();
            }
          },
          (err) => {
            if (!bestPos) {
              clearTimeout(timer);
              reject(err);
            }
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 }
        );
      });
    } else {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('PERM_DENIED');
      }

      let bestFix: any = null;
      let sub: any = null;

      try {
        return await new Promise(async (resolve, reject) => {
          const timer = setTimeout(async () => {
            sub?.remove?.();
            if (bestFix) {
              resolve({
                latitude: bestFix.coords.latitude,
                longitude: bestFix.coords.longitude,
                accuracy: Math.round(bestFix.coords.accuracy || 15),
              });
            } else {
              try {
                const fallback = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Highest,
                });
                resolve({
                  latitude: fallback.coords.latitude,
                  longitude: fallback.coords.longitude,
                  accuracy: Math.round(fallback.coords.accuracy || 20),
                });
              } catch (e) {
                reject(e);
              }
            }
          }, 3500);

          sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 300,
              distanceInterval: 0,
            },
            (loc) => {
              if (
                !bestFix ||
                (loc.coords.accuracy && loc.coords.accuracy < (bestFix.coords.accuracy || 999))
              ) {
                bestFix = loc;
              }
              if (loc.coords.accuracy && loc.coords.accuracy <= 10) {
                clearTimeout(timer);
                sub?.remove?.();
                resolve({
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                  accuracy: Math.round(loc.coords.accuracy),
                });
              }
            }
          );
        });
      } finally {
        sub?.remove?.();
      }
    }
  };

  // 🛰️ EXACT PLACE NAME & BUILDING DETECTOR
  const scanLiveLocation = async () => {
    setIsAutoDetecting(true);
    setNearbyVenueFound(null);
    setDetectedCandidates([]);

    try {
      const fix = await acquireBestGpsFix();
      const { latitude, longitude, accuracy } = fix;

      const poiCandidates: Array<{ label: string; type: string; isPoi: boolean }> = [];
      let formattedStreet = '';

      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=zh-TW`,
          { headers: { 'User-Agent': 'MochiVisibleDialogApp/3.0' } }
        );
        const nomData = await nomRes.json();
        const addr = nomData?.address || {};

        const namedParts = [
          nomData?.name,
          addr.shop,
          addr.amenity,
          addr.building,
          addr.university,
          addr.college,
          addr.leisure,
          addr.tourism,
          addr.office,
          addr.commercial,
        ].filter(Boolean);

        namedParts.forEach((pName) => {
          if (pName && pName !== addr.road && !/^\d+號?$/.test(pName)) {
            if (!poiCandidates.some((c) => c.label === pName)) {
              poiCandidates.push({
                label: pName,
                type: inferCategoryType(pName, nomData?.type || nomData?.category || ''),
                isPoi: true,
              });
            }
          }
        });

        const district = addr.suburb || addr.city_district || addr.town || addr.city || '';
        const road = addr.road || addr.pedestrian || addr.neighbourhood || '';
        const rawHouse = (addr.house_number || '').trim();
        const cleanHouse = rawHouse
          ? rawHouse.endsWith('號')
            ? rawHouse
            : `${rawHouse}號`
          : '';

        formattedStreet = [district, road, cleanHouse].filter(Boolean).join('');
      } catch (nomErr) {}

      try {
        const query = `[out:json][timeout:6];
          is_in(${latitude},${longitude})->.a;
          (
            way(pivot.a)["name"];
            relation(pivot.a)["name"];
            node(around:45,${latitude},${longitude})["name"];
            way(around:45,${latitude},${longitude})["name"];
          );
          out tags center;`;

        const res = await fetch(
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
        );
        const data = await res.json();

        if (data?.elements?.length > 0) {
          const scored = data.elements
            .filter((el: any) => {
              const t = el.tags || {};
              if (t.highway || t.public_transport || t.railway || t.boundary === 'administrative') {
                return false;
              }
              return Boolean(t['name:zh'] || t.name || t.brand);
            })
            .map((el: any) => {
              const elLat = el.lat ?? el.center?.lat ?? latitude;
              const elLon = el.lon ?? el.center?.lon ?? longitude;
              const distMeters =
                Math.hypot(elLat - latitude, elLon - longitude) * 111320;
              const t = el.tags || {};
              const nameZh = t['name:zh'] || t['brand:zh'] || t.name || t.brand || '';
              const branch = t.branch ? ` (${t.branch})` : '';
              const fullLabel = `${nameZh}${branch}`.trim();
              const cat = inferCategoryType(
                fullLabel,
                t.amenity || t.shop || t.building || ''
              );
              const isShopOrBuilding = Boolean(t.shop || t.amenity || t.building);
              const priorityScore = isShopOrBuilding ? distMeters : distMeters + 15;
              return { label: fullLabel, type: cat, score: priorityScore, distMeters };
            })
            .sort((a: any, b: any) => a.score - b.score);

          scored.forEach((item: any) => {
            if (
              item.label &&
              !poiCandidates.some((c) => c.label === item.label) &&
              poiCandidates.length < 6
            ) {
              poiCandidates.push({
                label: item.label,
                type: item.type,
                isPoi: true,
              });
            }
          });
        }
      } catch (osmErr) {
        console.warn('Overpass lookup warning:', osmErr);
      }

      if (Platform.OS !== 'web') {
        try {
          const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (rev && rev.length > 0) {
            const a = rev[0];
            if (a.name && a.name !== a.street && !/^\d+/.test(a.name)) {
              if (!poiCandidates.some((c) => c.label === a.name)) {
                poiCandidates.unshift({
                  label: a.name,
                  type: inferCategoryType(a.name),
                  isPoi: true,
                });
              }
            }
            if (!formattedStreet) {
              const rawNum = (a.streetNumber || '').trim();
              const cleanNum = rawNum
                ? rawNum.endsWith('號')
                  ? rawNum
                  : `${rawNum}號`
                : '';
              formattedStreet = [a.district || a.city, a.street, cleanNum]
                .filter(Boolean)
                .join('');
            }
          }
        } catch (e) {}
      }

      if (formattedStreet && !poiCandidates.some((c) => c.label === formattedStreet)) {
        poiCandidates.push({
          label: formattedStreet,
          type: 'other',
          isPoi: false,
        });
      }

      if (poiCandidates.length === 0) {
        poiCandidates.push({
          label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          type: 'other',
          isPoi: false,
        });
      }

      const bestMatch = poiCandidates.find((c) => c.isPoi) || poiCandidates[0];

      setDetectedCandidates(poiCandidates);
      setEditablePlaceName(bestMatch.label);
      setSelectedBaseType(bestMatch.type);
      setNearbyVenueFound({
        coords: { latitude, longitude },
        accuracy,
        streetAddress: formattedStreet,
      });
    } catch (e: any) {
      console.error('GPS Detection Error:', e);
      if (e?.message === 'PERM_DENIED') {
        Alert.alert(
          currentLang === 'zh-TW' ? '需要定位權限' : 'Location Permission Required',
          currentLang === 'zh-TW'
            ? '請允許定位權限以偵測目前地點名稱。'
            : 'Please allow location permission to detect your current place name.'
        );
      } else {
        setDetectedCandidates([]);
        setEditablePlaceName('');
        setSelectedBaseType('other');
        setNearbyVenueFound({ manualOnly: true });
      }
    } finally {
      setIsAutoDetecting(false);
    }
  };

  // 💾 SAVE EDITED LOCATION NAME AS SITUATION + CLOUD SYNC
  const handleSaveEditedLocationAsSituation = async () => {
    const finalNameZh = editablePlaceName.trim();
    if (!finalNameZh) {
      Alert.alert('請輸入名稱', '請輸入店名或地點名稱後再加入場景。');
      return;
    }

    let finalNameEn = finalNameZh;
    if (/[\u4e00-\u9fa5]/.test(finalNameZh)) {
      finalNameEn = await realTranslate(finalNameZh, 'zh-TW', 'en-US');
    }

    const template =
      VENUE_TEMPLATES.find((t) => t.id === selectedBaseType) || VENUE_TEMPLATES[6];

    const newDynamicVenue = {
      id: `loc_${Date.now()}`,
      baseType: selectedBaseType,
      isCustom: true,
      name: {
        'zh-TW': finalNameZh,
        'en-US': finalNameEn || finalNameZh,
      },
      short: {
        'zh-TW': finalNameZh.substring(0, 10),
        'en-US': (finalNameEn || finalNameZh).substring(0, 14),
      },
      emoji: template.emoji,
      coverImage: template.coverImage,
    };

    const existingIdx = venues.findIndex((v) => v.name['zh-TW'] === finalNameZh);
    let updatedVenues = [...venues];
    if (existingIdx !== -1) {
      updatedVenues[existingIdx] = newDynamicVenue;
    } else {
      updatedVenues = [newDynamicVenue, ...venues];
    }

    await persistVenues(updatedVenues);
    setActiveVenue(newDynamicVenue);
    setNearbyVenueFound(null);
    showToast(
      currentLang === 'zh-TW'
        ? `✓ 已儲存並同步至雲端：「${finalNameZh}」`
        : `✓ Saved & synced to cloud: "${finalNameZh}"`
    );
  };

  const handleTypeToClerkSubmit = async () => {
    if (customTypeInput.trim()) {
      let finalSpeech = customTypeInput.trim();
      let speechLang = currentLang;

      if (isTranslateMode && currentLang === 'en-US') {
        finalSpeech = await realTranslate(finalSpeech, 'en-US', 'zh-TW');
        speechLang = 'zh-TW';
      }
      triggerHaptic(80);
      setShowClerkBarcode(false);
      setClerkLabel(currentLang === 'zh-TW' ? '我打字跟您說' : 'Typed Message');
      setClerkMessage(finalSpeech);
      setClerkSub(currentLang === 'zh-TW' ? '請直接對手機說話，或點選問題' : 'Please speak or tap a question');
      speakSentence(finalSpeech, speechLang);

      const questionToBind =
        lastHeardQuestion ||
        (activePromptCard ? activePromptCard.question?.['zh-TW'] : '') ||
        liveStreamText;
      if (
        questionToBind &&
        questionToBind.length >= 2 &&
        !questionToBind.includes('請開始說話') &&
        !questionToBind.includes('Listening')
      ) {
        await learnNewConversationExchange(questionToBind, finalSpeech);
        setLastHeardQuestion('');
      }

      setCustomTypeInput('');
      setIsTypeToClerkOpen(false);
    }
  };

  const getPrioritizedCards = () => {
    const valid = cardsData.filter(
      (c) =>
        c.stores.includes(activeVenue.id) ||
        (activeVenue.baseType && c.stores.includes(activeVenue.baseType)) ||
        c.stores.includes('*')
    );
    return valid.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
  };

  const fs = (base: number) => Math.round(base * fontScale);

  // ============================================================================
  // 🏠 HOME SCREEN (Atmospheric Day/Night Sky + Frosted Weather-Style Cards)
  // ============================================================================
  if (!isCounterMode) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: THEME.bg,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* ✨ Live Atmospheric Day/Night Sky Background */}
        <AmbientBackground themeMode={themeMode} isListening={false} />

        {/* Top Navigation — Branded as 看得見的對話 / Mochi */}
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
            <Pressable
              onPress={scanLiveLocation}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: THEME.surface, borderColor: THEME.border },
                nearbyVenueFound && { borderColor: THEME.success },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              {isAutoDetecting ? (
                <ActivityIndicator size="small" color={THEME.orange} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="location-outline" size={fs(16)} color={THEME.orange} />
                  <Text style={[styles.iconText, { color: THEME.text, fontSize: fs(14) }]}>
                    {currentLang === 'zh-TW' ? '定位' : 'GPS'}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => setIsTranslateMode(!isTranslateMode)}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: THEME.surface, borderColor: THEME.border },
                isTranslateMode && {
                  backgroundColor: 'rgba(76, 201, 240, 0.22)',
                  borderColor: THEME.translateAccent,
                },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              <Text
                style={[
                  styles.iconText,
                  { color: THEME.text, fontSize: fs(14) },
                  isTranslateMode && { color: THEME.translateAccent, fontWeight: '800' },
                ]}
              >
                A/文
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setIsSettingsOpen(true)}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: THEME.surface, borderColor: THEME.border },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              <Ionicons name="options-outline" size={fs(18)} color={THEME.text} />
            </Pressable>
          </View>
        </View>

        {/* ✨ TOAST NOTIFICATION */}
        {!!saveToastMsg && (
          <View style={styles.toastBanner}>
            <Text style={[styles.toastBannerText, { fontSize: fs(14) }]}>
              {saveToastMsg}
            </Text>
          </View>
        )}

        {/* 🛰️ PRECISE PLACE NAME DETECTOR & EDITABLE SITUATION CREATOR */}
        {nearbyVenueFound && (
          <View style={styles.satelliteDropdownContainer}>
            <View
              style={[
                styles.satelliteEditorCard,
                { backgroundColor: THEME.surfaceSolid, borderColor: THEME.success },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <View style={styles.nearbyPulseDot} />
                  <Text style={[styles.satelliteFoundLabel, { fontSize: fs(13), flex: 1 }]}>
                    {nearbyVenueFound.manualOnly
                      ? currentLang === 'zh-TW'
                        ? '新增自訂場景名稱：'
                        : 'Add Custom Situation:'
                      : currentLang === 'zh-TW'
                      ? `目前精準定位地點 ${
                          nearbyVenueFound.accuracy ? `(誤差 ±${nearbyVenueFound.accuracy}m)` : ''
                        }：`
                      : `Precise Location ${
                          nearbyVenueFound.accuracy ? `(±${nearbyVenueFound.accuracy}m)` : ''
                        }:`}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {!nearbyVenueFound.manualOnly && (
                    <TouchableOpacity
                      style={[
                        styles.rescanSmallBtn,
                        { backgroundColor: THEME.surfaceLight, borderColor: THEME.orange },
                      ]}
                      onPress={scanLiveLocation}
                    >
                      <Text style={{ color: THEME.orange, fontSize: fs(12), fontWeight: '700' }}>
                        🔄 {currentLang === 'zh-TW' ? '重新定位' : 'Re-scan'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.dismissPillBtn}
                    onPress={() => setNearbyVenueFound(null)}
                  >
                    <Ionicons name="close" size={fs(18)} color={THEME.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {nearbyVenueFound.accuracy && nearbyVenueFound.accuracy > 150 && (
                <Text style={{ color: THEME.orange, fontSize: fs(12), marginBottom: 6 }}>
                  ⚠️{' '}
                  {currentLang === 'zh-TW'
                    ? '電腦瀏覽器無 GPS 晶片，可能顯示電信商機房位置；用手機開啟即可取得精準店名，或直接於下方修改名稱：'
                    : 'Desktop browser uses network IP location. Open on phone for exact GPS or edit name below:'}
                </Text>
              )}

              {detectedCandidates.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 8 }}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {detectedCandidates.map((cand, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.candidateChip,
                        { backgroundColor: THEME.surfaceLight, borderColor: THEME.border },
                        editablePlaceName === cand.label && styles.candidateChipActive,
                      ]}
                      onPress={() => {
                        setEditablePlaceName(cand.label);
                        setSelectedBaseType(cand.type);
                      }}
                    >
                      <Text
                        style={[
                          styles.candidateChipText,
                          { color: THEME.text, fontSize: fs(13) },
                          editablePlaceName === cand.label && {
                            color: '#000',
                            fontWeight: '800',
                          },
                        ]}
                      >
                        {cand.isPoi ? '🏢 ' : '📍 '}
                        {cand.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <TextInput
                style={[
                  styles.editableLocationInput,
                  {
                    backgroundColor: THEME.bg,
                    color: THEME.text,
                    borderColor: THEME.border,
                    fontSize: fs(16),
                  },
                ]}
                value={editablePlaceName}
                onChangeText={setEditablePlaceName}
                placeholder={
                  currentLang === 'zh-TW'
                    ? '輸入或修改地點名稱 (例如：元智大學 / 7-11)...'
                    : 'Enter or edit place name...'
                }
                placeholderTextColor={THEME.textMuted}
              />

              <Text style={{ color: THEME.textMuted, fontSize: fs(12), marginBottom: 6 }}>
                {currentLang === 'zh-TW'
                  ? '選擇問題模板類型：'
                  : 'Select question template type:'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10 }}
                contentContainerStyle={{ gap: 6 }}
              >
                {VENUE_TEMPLATES.map((tpl) => (
                  <TouchableOpacity
                    key={tpl.id}
                    style={[
                      styles.templateTypeChip,
                      { backgroundColor: THEME.bg, borderColor: THEME.border },
                      selectedBaseType === tpl.id && styles.templateTypeChipActive,
                    ]}
                    onPress={() => setSelectedBaseType(tpl.id)}
                  >
                    <Text
                      style={[
                        styles.templateTypeChipText,
                        { color: THEME.text, fontSize: fs(13) },
                        selectedBaseType === tpl.id && {
                          color: '#000',
                          fontWeight: '800',
                        },
                      ]}
                    >
                      {currentLang === 'zh-TW' ? tpl.label : tpl.enLabel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.saveLocationConfirmBtn}
                onPress={handleSaveEditedLocationAsSituation}
              >
                <Text style={[styles.saveLocationConfirmBtnText, { fontSize: fs(15) }]}>
                  {currentLang === 'zh-TW'
                    ? '＋ 儲存名稱並設為目前場景'
                    : '＋ Save & Set as Active Situation'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.mainScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={styles.greetingSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons
                name={themeMode === 'dark' ? 'moon' : 'sunny'}
                size={fs(16)}
                color={THEME.orange}
              />
              <Text style={{ color: THEME.orange, fontSize: fs(13), fontWeight: '800', letterSpacing: 0.6 }}>
                {themeMode === 'dark'
                  ? currentLang === 'zh-TW'
                    ? '星夜深色模式'
                    : 'MIDNIGHT MODE'
                  : currentLang === 'zh-TW'
                  ? '晴空淺色模式'
                  : 'DAYLIGHT MODE'}
              </Text>
            </View>
            <Text style={[styles.greetingTitle, { color: THEME.text, fontSize: fs(28) }]}>
              {currentLang === 'zh-TW' ? '準備好開始對話' : 'Ready to Communicate'}
            </Text>
            <Text style={[styles.greetingSub, { color: THEME.textMuted, fontSize: fs(15) }]}>
              {currentLang === 'zh-TW'
                ? '選擇當前場景，快速雙向溝通：'
                : 'Select a situation for instant two-way dialog:'}
            </Text>
          </View>

          {/* Sleek Frosted Weather-Style Hero Card */}
          <View
            style={[
              styles.heroCard,
              { backgroundColor: THEME.surface, borderColor: THEME.border },
            ]}
          >
            <View style={{ width: '100%', position: 'relative' }}>
              <Image source={{ uri: getActiveCoverImage() }} style={styles.heroImageCentered} />
              <View style={styles.heroImageBadge}>
                <Text style={{ color: '#FFF', fontSize: fs(12), fontWeight: '700' }}>
                  {activeVenue.emoji} {getVenueShortName(activeVenue)}
                </Text>
              </View>
            </View>

            <View style={styles.heroContent}>
              <Text
                style={[
                  styles.heroTitle,
                  { color: THEME.text, fontSize: fs(23), marginBottom: 14 },
                ]}
              >
                {activeVenue.name[currentLang] || activeVenue.name['zh-TW']}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.startModeBtn,
                  { backgroundColor: THEME.orange },
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
                ]}
                onPress={() => {
                  resetStageToIdle();
                  setIsCounterMode(true);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="swap-vertical" size={fs(20)} color="#000" />
                  <Text style={[styles.startModeBtnText, { fontSize: fs(17) }]}>
                    {currentLang === 'zh-TW' ? '開始櫃檯模式' : 'Start Counter Mode'}
                  </Text>
                </View>
              </Pressable>
              <Text style={[styles.heroHint, { color: THEME.textMuted, fontSize: fs(13) }]}>
                {currentLang === 'zh-TW'
                  ? '手機平放在櫃檯上，上半部自動翻轉 180° 朝向店員。'
                  : 'Place flat on counter; top half flips 180° toward clerk.'}
              </Text>
            </View>
          </View>

          {/* Clean All Situations Carousel */}
          <View style={styles.carouselSection}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingRight: 16,
                marginBottom: 12,
              }}
            >
              <Text
                style={[
                  styles.carouselTitle,
                  { color: THEME.text, fontSize: fs(17), marginBottom: 0 },
                ]}
              >
                {currentLang === 'zh-TW' ? '切換所有場景' : 'All Situations'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setDetectedCandidates([]);
                  setEditablePlaceName('');
                  setSelectedBaseType('other');
                  setNearbyVenueFound({ manualOnly: true });
                }}
              >
                <Text style={{ color: THEME.orange, fontSize: fs(14), fontWeight: '700' }}>
                  ＋ {currentLang === 'zh-TW' ? '新增自訂場景' : 'Add Situation'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselScroll}
            >
              {venues.map((v) => {
                const isSelected = activeVenue.id === v.id;
                return (
                  <Pressable
                    key={v.id}
                    style={({ pressed }) => [
                      styles.carouselItem,
                      pressed && { transform: [{ scale: 0.95 }] },
                    ]}
                    onPress={() => setActiveVenue(v)}
                  >
                    <View
                      style={[
                        styles.carouselImgRing,
                        isSelected && { borderColor: THEME.orange, borderWidth: 2.5 },
                      ]}
                    >
                      <Image
                        source={{ uri: customWallpapers[v.id] || v.coverImage }}
                        style={styles.carouselItemImg}
                      />
                    </View>
                    <Text
                      style={[
                        styles.carouselItemText,
                        { color: THEME.textMuted, fontSize: fs(13) },
                        isSelected && {
                          color: THEME.orange,
                          fontWeight: '800',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {getVenueShortName(v)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Modal: Settings with Animated Pinterest Day/Night Scenery Toggle */}
        <Modal visible={isSettingsOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <ScrollView
              style={[styles.settingsModalCardFull, { backgroundColor: THEME.bg }]}
              contentContainerStyle={{ padding: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <AmbientBackground themeMode={themeMode} />

              <View style={styles.settingsHeader}>
                <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
                  <Ionicons name="arrow-back" size={fs(26)} color={THEME.text} />
                </TouchableOpacity>
                <Text
                  style={[styles.settingsModalTitle, { color: THEME.text, fontSize: fs(22) }]}
                >
                  {currentLang === 'zh-TW' ? '設定與場景管理' : 'Settings & Situations'}
                </Text>
                <View style={{ width: 24 }} />
              </View>

              {/* 🌞🌚 PINTEREST DAY / NIGHT SCENERY SHOWCASE CARD */}
              <View
                style={[
                  styles.themeShowcaseCard,
                  { backgroundColor: THEME.surface, borderColor: THEME.border },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: THEME.orange, fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8 }}>
                    {themeMode === 'dark' ? 'MIDNIGHT SKY' : 'DAYLIGHT SKY'}
                  </Text>
                  <Text
                    style={{
                      color: THEME.text,
                      fontSize: fs(19),
                      fontWeight: '800',
                      marginTop: 2,
                    }}
                  >
                    {themeMode === 'dark'
                      ? currentLang === 'zh-TW'
                        ? '星夜深色主題'
                        : 'Starry Night Mode'
                      : currentLang === 'zh-TW'
                      ? '晴空淺色主題'
                      : 'Sunny Day Mode'}
                  </Text>
                  <Text style={{ color: THEME.textMuted, fontSize: fs(13), marginTop: 4 }}>
                    {currentLang === 'zh-TW'
                      ? '點擊右側開關切換日夜天空動態背景'
                      : 'Tap the sky switch to toggle Day & Night mode'}
                  </Text>
                </View>

                <DayNightScenerySwitch themeMode={themeMode} onToggle={toggleThemeMode} />
              </View>

              <View style={[styles.settingsDivider, { backgroundColor: THEME.border }]} />

              {/* Font Scale Section */}
              <Text
                style={[styles.settingsSectionTitle, { color: THEME.text, fontSize: fs(18) }]}
              >
                {currentLang === 'zh-TW'
                  ? '字體與按鈕大小 (全畫面即時縮放)'
                  : 'Font & UI Scale (Global)'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {FONT_SCALE_OPTIONS.map((f) => (
                  <TouchableOpacity
                    key={f.label}
                    style={[
                      styles.fontBtn,
                      { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border },
                      fontScale === f.val && {
                        backgroundColor: THEME.orange,
                        borderColor: THEME.orange,
                      },
                    ]}
                    onPress={() => persistFontScale(f.val)}
                  >
                    <Text
                      style={[
                        styles.fontBtnText,
                        { color: THEME.text, fontSize: fs(15) },
                        fontScale === f.val && { color: '#000', fontWeight: '800' },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.settingsDivider, { backgroundColor: THEME.border }]} />

              {/* E-Invoice Carrier Code Setting */}
              <Text
                style={[styles.settingsSectionTitle, { color: THEME.text, fontSize: fs(18) }]}
              >
                {currentLang === 'zh-TW'
                  ? '手機載具條碼設定 (E-Invoice Carrier)'
                  : 'E-Invoice Carrier Barcode'}
              </Text>
              <Text style={{ color: THEME.textMuted, fontSize: fs(13), marginBottom: 8 }}>
                {currentLang === 'zh-TW'
                  ? '當您在櫃檯點選「手機條碼」時，店員端 180° 畫面會自動顯示此條碼供掃描：'
                  : 'Shown on the 180° clerk screen when you tap Phone Barcode:'}
              </Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: THEME.surfaceSolid,
                    color: THEME.text,
                    borderColor: THEME.border,
                    marginBottom: 8,
                    fontSize: fs(16),
                  },
                ]}
                placeholder="/ABC1234"
                placeholderTextColor={THEME.textMuted}
                value={carrierCode}
                onChangeText={persistCarrierCode}
                autoCapitalize="characters"
              />

              <View style={[styles.settingsDivider, { backgroundColor: THEME.border }]} />

              {/* Custom Wallpaper URL (Cloud Synced) */}
              <Text
                style={[styles.settingsSectionTitle, { color: THEME.text, fontSize: fs(18) }]}
              >
                {currentLang === 'zh-TW'
                  ? `自訂「${activeVenue.name['zh-TW']}」封面圖片 (全球同步)`
                  : `Custom Wallpaper for ${activeVenue.name['en-US']} (Cloud Synced)`}
              </Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: THEME.surfaceSolid,
                    color: THEME.text,
                    borderColor: THEME.border,
                    marginBottom: 8,
                    fontSize: fs(15),
                  },
                ]}
                placeholder="https://images.unsplash.com/..."
                placeholderTextColor={THEME.textMuted}
                value={wallpaperInputUrl}
                onChangeText={setWallpaperInputUrl}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={saveCustomWallpaper}>
                <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>
                  {currentLang === 'zh-TW'
                    ? '☁️ 儲存並同步封面至所有網站/裝置'
                    : '☁️ Save & Sync Wallpaper Globally'}
                </Text>
              </TouchableOpacity>

              <View style={[styles.settingsDivider, { backgroundColor: THEME.border }]} />

              {/* Manage Situations */}
              <Text
                style={[styles.settingsSectionTitle, { color: THEME.text, fontSize: fs(18) }]}
              >
                {currentLang === 'zh-TW' ? '管理所有場景 (Manage Situations)' : 'Manage Situations'}
              </Text>
              {venues.map((v) => (
                <View
                  key={v.id}
                  style={[
                    styles.manageVenueRow,
                    { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border },
                  ]}
                >
                  <Text style={{ color: THEME.text, fontSize: fs(16), flex: 1 }}>
                    {v.emoji} {v.name[currentLang] || v.name['zh-TW']}
                  </Text>
                  {venues.length > 1 && (
                    <TouchableOpacity
                      style={styles.manageVenueDeleteBtn}
                      onPress={() => handleDeleteVenue(v.id)}
                    >
                      <Text style={{ color: THEME.danger, fontSize: fs(14), fontWeight: '700' }}>
                        🗑️ {currentLang === 'zh-TW' ? '刪除' : 'Delete'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View style={[styles.settingsDivider, { backgroundColor: THEME.border }]} />

              {/* Translation & Language */}
              <Text
                style={[styles.settingsSectionTitle, { color: THEME.text, fontSize: fs(18) }]}
              >
                {currentLang === 'zh-TW' ? '翻譯與語言' : 'Translation & Language'}
              </Text>
              <View style={styles.settingRow}>
                <Text style={[styles.settingRowLabel, { color: THEME.text, fontSize: fs(16) }]}>
                  {currentLang === 'zh-TW' ? 'A/文 即時雙語翻譯' : 'A/文 Live Translate Mode'}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border },
                    isTranslateMode && styles.toggleSwitchActive,
                  ]}
                  onPress={() => setIsTranslateMode(!isTranslateMode)}
                >
                  <View
                    style={[styles.toggleThumb, isTranslateMode && styles.toggleThumbActive]}
                  />
                </TouchableOpacity>
              </View>

              {LANGUAGE_LIST.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOptionItem,
                    { backgroundColor: THEME.surfaceSolid },
                    currentLang === lang.code && { backgroundColor: THEME.surfaceLight },
                  ]}
                  onPress={() => setCurrentLang(lang.code as SupportedLang)}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      { color: THEME.text, fontSize: fs(16) },
                      currentLang === lang.code && { color: THEME.orange, fontWeight: 'bold' },
                    ]}
                  >
                    {lang.name}
                  </Text>
                  {currentLang === lang.code && (
                    <Text style={{ color: THEME.orange, fontWeight: 'bold', fontSize: fs(16) }}>
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
              ))}

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  // ============================================================================
  // 🔄 COUNTER SPLIT MODE (Sleek Signage Top + Atmospheric Day/Night Bottom)
  // ============================================================================
  const prioritizedCards = getPrioritizedCards();

  return (
    <View style={[styles.screen, { backgroundColor: THEME.bg }]}>
      {/* ✨ Live Atmospheric Day/Night Sky Background in Counter Mode */}
      <AmbientBackground themeMode={themeMode} isListening={isLiveActive} isCounter />

      {/* 🟠 TOP HALF: Industrial Dark Signage 180° Rotated Clerk Display */}
      <View
        style={[
          styles.splitTop,
          { backgroundColor: THEME.clerkBg, paddingTop: Math.max(insets.top, 10) },
        ]}
      >
        <View style={styles.splitTopInner}>
          <View style={styles.clerkTopActionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.clerkOfflinePickPill,
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              ]}
              onPress={() => {
                setClerkPickView('grid');
                setClerkDigits('');
                setIsClerkPickOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="店員點選問題 (Offline Clerk Pick)"
            >
              <Text style={[styles.clerkOfflinePickText, { fontSize: fs(17) }]}>
                {currentLang === 'zh-TW'
                  ? '或點這裡，選您要問的問題'
                  : 'Tap here to pick a question'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.clerkRoundSpeakBtn,
                pressed && { transform: [{ scale: 0.92 }], opacity: 0.8 },
              ]}
              onPress={() =>
                speakSentence(
                  clerkMessage ||
                    (currentLang === 'zh-TW'
                      ? '我是聽障者，請對著手機說話，或點選問題'
                      : 'I am deaf or hard of hearing. Please speak to the phone or tap a question.'),
                  'zh-TW'
                )
              }
              accessibilityRole="button"
              accessibilityLabel="播放語音"
            >
              <Ionicons name="volume-high" size={fs(26)} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.clerkMainMessageContainer}>
            {clerkMessage ? (
              <>
                {!!clerkLabel && (
                  <Text style={[styles.clerkStatusLabel, { fontSize: fs(16) }]}>
                    {clerkLabel}
                  </Text>
                )}
                <Text
                  style={[
                    styles.clerkMainMessageLarge,
                    {
                      fontSize: fs(
                        showClerkBarcode ? 30 : clerkMessage.length <= 5 ? 54 : 38
                      ),
                      lineHeight: fs(
                        showClerkBarcode ? 36 : clerkMessage.length <= 5 ? 62 : 46
                      ),
                    },
                  ]}
                  adjustsFontSizeToFit
                  numberOfLines={2}
                >
                  {clerkMessage}
                </Text>

                {showClerkBarcode && (
                  <View style={styles.clerkBarcodeCard}>
                    <View style={styles.clerkBarcodeBarsRow}>
                      {BARCODE_WEIGHTS.map((w, i) => (
                        <View
                          key={i}
                          style={{
                            width: w * 2.2,
                            height: 44,
                            backgroundColor: i % 2 === 0 ? '#000' : 'transparent',
                          }}
                        />
                      ))}
                    </View>
                    <Text style={styles.clerkBarcodeCodeText}>{carrierCode}</Text>
                  </View>
                )}

                <Text style={[styles.clerkSecondaryMessage, { fontSize: fs(15) }]}>
                  {clerkSub ||
                    (currentLang === 'zh-TW'
                      ? '請直接對手機說話，或點上方橘色按鈕選問題'
                      : 'Speak directly to phone or tap orange button above')}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.clerkStatusLabel, { fontSize: fs(16) }]}>
                  {currentLang === 'zh-TW' ? '溝通提示卡' : 'Counter Sign'}
                </Text>
                <Text
                  style={[
                    styles.clerkDefaultHeadline,
                    { fontSize: fs(36), lineHeight: fs(44) },
                  ]}
                >
                  {currentLang === 'zh-TW' ? '我是聽障者' : 'I am D/HH'}
                </Text>
                <Text
                  style={[
                    styles.clerkDefaultHeadline,
                    { fontSize: fs(36), lineHeight: fs(44), color: THEME.orange },
                  ]}
                >
                  {currentLang === 'zh-TW' ? '請對著手機說話' : 'Please speak to phone'}
                </Text>
                <Text style={[styles.clerkDefaultSub, { fontSize: fs(16) }]}>
                  {currentLang === 'zh-TW'
                    ? '我會用螢幕回答您 · 太吵可點上方選問題'
                    : 'I will answer via screen · Or tap button above'}
                </Text>
              </>
            )}
          </View>
        </View>
        <Text style={[styles.clerkFlipEdgeHint, { fontSize: fs(12) }]}>
          {currentLang === 'zh-TW' ? '這一面朝向店員' : 'This side faces the clerk'}
        </Text>
      </View>

      <View style={styles.splitAmberDivider} />

      {/* ⚫ BOTTOM HALF: User-Facing Control Panel */}
      <View
        style={[
          styles.splitBottom,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        <View style={styles.bottomHeaderGroup}>
          <View style={styles.bottomHeader}>
            <Pressable
              style={({ pressed }) => [
                styles.venueDropdown,
                { backgroundColor: THEME.surface, borderColor: THEME.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setIsCounterMode(false)}
            >
              <Text style={[styles.venueDropdownText, { color: THEME.text, fontSize: fs(15) }]}>
                {activeVenue.emoji} {getVenueShortName(activeVenue)} ▾
              </Text>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.offlineModePill,
                  { backgroundColor: THEME.surfaceLight, borderColor: THEME.orange },
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
                onPress={() => {
                  setClerkPickView('grid');
                  setClerkDigits('');
                  setIsClerkPickOpen(true);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="grid-outline" size={fs(14)} color={THEME.orange} />
                  <Text style={[styles.offlineModePillText, { fontSize: fs(14) }]}>
                    {currentLang === 'zh-TW' ? '店員點選' : 'Clerk Pick'}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.liveStatusPill,
                  {
                    backgroundColor: isLiveActive
                      ? 'rgba(46, 196, 182, 0.16)'
                      : THEME.surface,
                    borderColor: isLiveActive ? THEME.success : THEME.border,
                  },
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
                onPress={toggleLiveListening}
              >
                <LiveAudioWave active={isLiveActive} color={THEME.success} />
                <Text
                  style={[
                    styles.liveStatusText,
                    {
                      color: isLiveActive ? THEME.success : THEME.text,
                      fontSize: fs(14),
                    },
                  ]}
                >
                  {isLiveActive
                    ? currentLang === 'zh-TW'
                      ? '正在聽'
                      : 'Listening'
                    : currentLang === 'zh-TW'
                    ? '點我開始聽'
                    : 'Tap to Listen'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.smallSettingsBtn,
                  { backgroundColor: THEME.surface, borderColor: THEME.border },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setIsSettingsOpen(true)}
                accessibilityLabel="字體與設定"
              >
                <Text style={{ color: THEME.text, fontSize: fs(15), fontWeight: '800' }}>
                  Aa
                </Text>
              </Pressable>
            </View>
          </View>

          {!!saveToastMsg && (
            <View style={[styles.toastBanner, { marginHorizontal: 0, marginBottom: 8 }]}>
              <Text style={[styles.toastBannerText, { fontSize: fs(13) }]}>
                {saveToastMsg}
              </Text>
            </View>
          )}

          {/* 🎉 NUMBER CALLED ALERT BANNER */}
          {numberCalledAlert && (
            <Pressable
              style={{
                backgroundColor: THEME.orange,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 14,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onPress={() => {
                setNumberCalledAlert(false);
                setWatchNumber('');
              }}
            >
              <Text style={{ color: '#000', fontSize: fs(17), fontWeight: '900' }}>
                🎉 到您了！櫃檯正在叫 #{watchNumber} 號
              </Text>
              <Text style={{ color: '#000', fontSize: fs(13), fontWeight: '800' }}>關閉 ✕</Text>
            </Pressable>
          )}

          {/* 🧋 MULTI-SELECT ORDER COMBO BUILDER TRAY */}
          {comboItems.length > 1 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: THEME.surface,
                borderColor: THEME.orange,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginBottom: 8,
                gap: 8,
              }}
            >
              <Text
                style={{ color: THEME.text, fontSize: fs(14), fontWeight: '700', flex: 1 }}
                numberOfLines={1}
              >
                ✨ 組合：{comboItems.join(' · ')}
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: THEME.orange,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                }}
                onPress={() => {
                  const fullSentence = comboItems.join('、');
                  setClerkLabel(currentLang === 'zh-TW' ? '我的完整點餐' : 'My Full Order');
                  setClerkMessage(fullSentence);
                  speakSentence(fullSentence, 'zh-TW');
                }}
              >
                <Text style={{ color: '#000', fontSize: fs(13), fontWeight: '800' }}>
                  🔊 整句唸出
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setComboItems([])} style={{ paddingHorizontal: 4 }}>
                <Text style={{ color: THEME.textMuted, fontSize: fs(14) }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {smartReplies.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 8 }}
              contentContainerStyle={{ alignItems: 'center', gap: 8 }}
            >
              {smartReplies.map((reply: any) => (
                <View
                  key={reply.id}
                  style={[styles.smartReplyPillWrap, { backgroundColor: THEME.surface }]}
                >
                  <TouchableOpacity
                    style={styles.smartReplyMainTap}
                    onPress={() => {
                      if (reply.cardRef) openCardStage(reply.cardRef);
                      handleSelectOption(reply, reply.optRef);
                    }}
                  >
                    <Text style={[styles.smartReplyBtnText, { color: THEME.text, fontSize: fs(15) }]}>
                      💡 {reply.text}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.smartReplySpeakerTap,
                      { backgroundColor: THEME.surfaceLight, borderLeftColor: THEME.border },
                    ]}
                    onPress={() => speakSentence(reply.clerkText || reply.text, 'zh-TW')}
                    accessibilityLabel="試聽這句話"
                  >
                    <Ionicons name="volume-high-outline" size={fs(16)} color={THEME.orange} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {liveStreamText ? (
            <View
              style={[
                styles.liveSubtitleBox,
                { backgroundColor: THEME.surfaceLight, borderColor: THEME.success },
              ]}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.liveSubtitleText, { color: THEME.success, fontSize: fs(18) }]}>
                  "{liveStreamText}"
                </Text>
                {!liveStreamText.includes('請開始說話') &&
                  !liveStreamText.includes('Listening') && (
                    <TouchableOpacity
                      style={{ marginTop: 6 }}
                      onPress={() => {
                        setNewQuestionInput(liveStreamText.replace(/\.\.\.$/, '').trim());
                        setNewAnswerInput('');
                        setIsAddQaOpen(true);
                      }}
                    >
                      <Text
                        style={{
                          color: THEME.orange,
                          fontSize: fs(13),
                          fontWeight: '700',
                        }}
                      >
                        ＋ 儲存這句問題與我的回答（下次自動建議）
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
              <TouchableOpacity
                style={[
                  styles.subtitleSpeakerBtn,
                  { backgroundColor: THEME.surface, borderColor: THEME.orange },
                ]}
                onPress={() => speakSentence(liveStreamText)}
                accessibilityRole="button"
                accessibilityLabel="播放聽到的句子"
              >
                <Ionicons name="volume-high" size={fs(20)} color={THEME.orange} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* 📋 MAIN STAGE AREA */}
        <ScrollView
          style={styles.questionsList}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        >
          {pendingAmount !== null ? (
            <View
              style={[
                styles.stageActiveCard,
                { backgroundColor: THEME.surface, borderColor: THEME.orange },
              ]}
            >
              <View style={styles.stageCardHeader}>
                <TouchableOpacity onPress={resetStageToIdle} style={styles.stageBackBtn}>
                  <Text style={[styles.stageBackText, { color: THEME.textMuted, fontSize: fs(15) }]}>
                    ‹ {currentLang === 'zh-TW' ? '返回' : 'Back'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.stageCardCaption, { color: THEME.textMuted, fontSize: fs(14) }]}>
                  {currentLang === 'zh-TW' ? '店員輸入的金額' : 'Clerk Entered Amount'}
                </Text>
                <TouchableOpacity
                  onPress={() => speakSentence(`${pendingAmount}元`, 'zh-TW')}
                  style={[styles.stageSpeakSmallBtn, { backgroundColor: THEME.surfaceLight }]}
                >
                  <Ionicons name="volume-high" size={fs(18)} color={THEME.orange} />
                </TouchableOpacity>
              </View>

              <View style={[styles.amountDisplayWell, { backgroundColor: THEME.bg }]}>
                <Text style={[styles.amountCurrencyText, { color: THEME.textMuted, fontSize: fs(20) }]}>
                  NT$
                </Text>
                <Text style={[styles.amountFigureText, { color: THEME.text, fontSize: fs(48) }]}>
                  {pendingAmount.toLocaleString('zh-TW')}
                </Text>
                <Text style={[styles.amountCurrencyText, { color: THEME.textMuted, fontSize: fs(20) }]}>
                  元
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.amountConfirmBtn, { backgroundColor: THEME.orange }]}
                  onPress={() => handleConfirmAmount(true)}
                >
                  <Text style={{ color: '#000', fontSize: fs(18), fontWeight: '800' }}>
                    ✓ {currentLang === 'zh-TW' ? '對，確認' : 'Confirm'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.amountConfirmBtn, { backgroundColor: THEME.danger }]}
                  onPress={() => handleConfirmAmount(false)}
                >
                  <Text style={{ color: '#FFF', fontSize: fs(18), fontWeight: '800' }}>
                    ✕ {currentLang === 'zh-TW' ? '不對，重按' : 'Wrong'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : activePromptCard ? (
            <View
              style={[
                styles.stageActiveCard,
                { backgroundColor: THEME.surface, borderColor: THEME.orange },
              ]}
            >
              <View style={styles.stageCardHeader}>
                <TouchableOpacity onPress={resetStageToIdle} style={styles.stageBackBtn}>
                  <Text style={[styles.stageBackText, { color: THEME.textMuted, fontSize: fs(15) }]}>
                    ‹ {currentLang === 'zh-TW' ? '返回' : 'Back'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.stageCardCaption, { color: THEME.textMuted, fontSize: fs(14) }]}>
                  {currentLang === 'zh-TW' ? '店員在問' : 'Clerk is asking'}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    speakSentence(
                      activePromptCard.question?.[currentLang] ||
                        activePromptCard.question?.['zh-TW'],
                      'zh-TW'
                    )
                  }
                  style={[styles.stageSpeakSmallBtn, { backgroundColor: THEME.surfaceLight }]}
                >
                  <Ionicons name="volume-high" size={fs(18)} color={THEME.orange} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.stageQuestionHeadline, { color: THEME.text, fontSize: fs(28) }]}>
                {activePromptCard.question?.[currentLang] ||
                  activePromptCard.question?.['zh-TW']}
              </Text>

              <View style={styles.stageOptionsGrid}>
                {activePromptCard.options.map((opt: any, idx: number) => {
                  const isFullWidth =
                    idx === activePromptCard.options.length - 1 &&
                    activePromptCard.options.length % 2 === 1;
                  const optLabel = opt.labels[currentLang] || opt.labels['zh-TW'];
                  const isSelected = chosenOption?.labels?.['zh-TW'] === opt.labels['zh-TW'];

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.stageOptionCell,
                        { width: isFullWidth ? '100%' : '50%' },
                      ]}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.stageOptionTile,
                          { backgroundColor: THEME.bg, borderColor: THEME.border },
                          isSelected && styles.stageOptionTileSelected,
                          pressed && { transform: [{ scale: 0.97 }] },
                        ]}
                        onPress={() =>
                          handleSelectOption(
                            {
                              text: optLabel,
                              clerkText: opt.tts || opt.labels['zh-TW'],
                            },
                            opt
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.stageOptionTileText,
                            { color: THEME.text, fontSize: fs(20) },
                            isSelected && { color: '#000', fontWeight: '800' },
                          ]}
                        >
                          {optLabel}
                        </Text>
                        {opt.subLabels && (
                          <Text
                            style={[
                              styles.stageOptionTileSub,
                              { color: THEME.textMuted, fontSize: fs(13) },
                              isSelected && { color: 'rgba(0,0,0,0.7)' },
                            ]}
                          >
                            {opt.subLabels[currentLang] || opt.subLabels['zh-TW']}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Header + Add New Custom Question/Answer Button */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              marginTop: 4,
            }}
          >
            <Text
              style={[
                styles.sectionListHeader,
                { color: THEME.textMuted, fontSize: fs(14), marginBottom: 0 },
              ]}
            >
              {currentLang === 'zh-TW'
                ? '點選問題或直接回答店員：'
                : 'Tap a question or answer directly:'}
            </Text>
            <TouchableOpacity
              style={[
                styles.addCustomQaBtn,
                { backgroundColor: THEME.surface, borderColor: THEME.orange },
              ]}
              onPress={() => {
                setNewQuestionInput(lastHeardQuestion || '');
                setNewAnswerInput('');
                setIsAddQaOpen(true);
              }}
            >
              <Text style={{ color: THEME.orange, fontSize: fs(13), fontWeight: '800' }}>
                ＋ {currentLang === 'zh-TW' ? '新增問題與回答' : 'Add Q&A'}
              </Text>
            </TouchableOpacity>
          </View>

          {prioritizedCards.map((card) => {
            const qTitle = card.question?.[currentLang] || card.question?.['zh-TW'];
            const isLearnedCard =
              card.isCustom || String(card.id).startsWith('learned_');
            return (
              <View
                key={card.id}
                style={[
                  styles.cardGroupBox,
                  { backgroundColor: THEME.surface, borderColor: THEME.border },
                ]}
              >
                {qTitle && (
                  <View
                    style={[
                      styles.cardQuestionHeaderRow,
                      { backgroundColor: THEME.surfaceLight, borderBottomColor: THEME.border },
                    ]}
                  >
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => openCardStage(card)}
                    >
                      <Text style={[styles.cardQuestionHeaderText, { fontSize: fs(16) }]}>
                        {isLearnedCard ? '✨ ' : ''}
                        {qTitle}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isLearnedCard && (
                        <TouchableOpacity
                          style={styles.deleteCardSmallBtn}
                          onPress={() => handleDeleteCard(card.id)}
                          accessibilityLabel="刪除此自訂問題"
                        >
                          <Text style={{ color: THEME.danger, fontSize: fs(13), fontWeight: '700' }}>
                            {currentLang === 'zh-TW' ? '刪除' : 'Delete'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[
                          styles.rowSpeakerIconBtn,
                          { backgroundColor: THEME.bg, borderColor: THEME.border },
                        ]}
                        onPress={() => speakSentence(qTitle, 'zh-TW')}
                        accessibilityLabel={`朗讀問題：${qTitle}`}
                      >
                        <Ionicons name="volume-high-outline" size={fs(18)} color={THEME.orange} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {card.options.map((opt: any, idx: number) => {
                  const mainLabel = opt.labels[currentLang] || opt.labels['zh-TW'];
                  const subLabel = opt.subLabels?.[currentLang] || opt.subLabels?.['zh-TW'];
                  return (
                    <View
                      key={`${card.id}_${idx}`}
                      style={[styles.questionRow, { borderBottomColor: THEME.border }]}
                    >
                      <TouchableOpacity
                        style={styles.questionTextCol}
                        onPress={() =>
                          handleSelectOption(
                            {
                              text: mainLabel,
                              clerkText: opt.tts || opt.labels['zh-TW'],
                            },
                            opt
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.questionTitle,
                            { color: THEME.text, fontSize: fs(19) },
                          ]}
                        >
                          {mainLabel}
                        </Text>
                        {subLabel && (
                          <Text
                            style={[
                              styles.questionSub,
                              { color: THEME.textMuted, fontSize: fs(14) },
                            ]}
                          >
                            {subLabel}
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.rowSpeakerIconBtn,
                          { backgroundColor: THEME.bg, borderColor: THEME.border },
                        ]}
                        onPress={() => speakSentence(opt.labels['zh-TW'], 'zh-TW')}
                        accessibilityLabel={`發音：${mainLabel}`}
                      >
                        <Ionicons name="volume-high-outline" size={fs(18)} color={THEME.text} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

                {/* Standalone Polite Phrases Bar */}
        <View style={{ flexDirection: 'row', gap: 8, paddingTop: 6 }}>
          {[
            { zh: '謝謝', en: 'Thank you', icon: '🙏' },
            { zh: '好的，謝謝', en: 'OK, thanks', icon: '👍' },
            { zh: '不好意思', en: 'Excuse me', icon: '🔔', chime: true },
          ].map((item) => (
            <Pressable
              key={item.zh}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: THEME.surface,
                  borderColor: THEME.orange,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                pressed && { transform: [{ scale: 0.96 }], opacity: 0.85 },
              ]}
              onPress={() => {
                if ((item as any).chime) playAttentionChime();
                else triggerHaptic(60);
                setShowClerkBarcode(false);
                setClerkLabel(currentLang === 'zh-TW' ? '禮貌致意' : 'Polite Note');
                setClerkMessage(item.zh);
                setClerkSub(currentLang === 'zh-TW' ? '感謝您的協助' : 'Thank you for your help');
                speakSentence(item.zh, 'zh-TW');
              }}
            >
              <Text style={{ color: THEME.text, fontSize: fs(14), fontWeight: '800' }}>
                {item.icon} {currentLang === 'zh-TW' ? item.zh : item.en}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Bottom Action Bar */}
        <View style={[styles.bottomActionBar, { backgroundColor: 'transparent' }]}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtnSecondary,
              { backgroundColor: THEME.surface, borderColor: THEME.border },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              const askAgain =
                currentLang === 'zh-TW'
                  ? '不好意思，我沒聽清楚，可以再說一次或用點的嗎？'
                  : 'Sorry, could you say that again or tap the screen?';
              setShowClerkBarcode(false);
              setClerkLabel(currentLang === 'zh-TW' ? '請再說一次' : 'Please Repeat');
              setClerkMessage(
                currentLang === 'zh-TW' ? '可以再說一次嗎？' : 'Could you repeat that?'
              );
              setClerkSub(
                currentLang === 'zh-TW'
                  ? '或點右上角「選您要問的問題」'
                  : 'Or tap the button above to pick a question'
              );
              speakSentence(askAgain, 'zh-TW');
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="help-circle-outline" size={fs(18)} color={THEME.text} />
              <Text style={[styles.actionBtnSecondaryText, { color: THEME.text, fontSize: fs(16) }]}>
                {currentLang === 'zh-TW' ? '我沒聽懂 / 再說一次' : 'Say Again'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionBtnPrimary,
              { backgroundColor: THEME.surfaceLight },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => setIsTypeToClerkOpen(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="create-outline" size={fs(18)} color={THEME.text} />
              <Text style={[styles.actionBtnPrimaryText, { color: THEME.text, fontSize: fs(16) }]}>
                {currentLang === 'zh-TW' ? '打字' : 'Type'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* ============================================================================ */}
      {/* 🔄 MODAL: 180° ROTATED OFFLINE CLERK PICK & AMOUNT KEYPAD */}
      {/* ============================================================================ */}
      <Modal
        visible={isClerkPickOpen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setIsClerkPickOpen(false)}
      >
        <View style={styles.clerkPickModalRoot}>
          <View
            style={[
              styles.clerkPickRotatedArea,
              {
                paddingTop: Math.max(insets.bottom, 16),
                paddingBottom: Math.max(insets.top, 16),
              },
            ]}
          >
            <View style={styles.clerkPickHeader}>
              <Text style={[styles.clerkPickOrangeSub, { fontSize: fs(16) }]}>
                {clerkPickView === 'grid'
                  ? currentLang === 'zh-TW'
                    ? '太吵了也沒關係'
                    : 'No problem if it is noisy'
                  : currentLang === 'zh-TW'
                  ? '請用按的'
                  : 'Enter on keypad'}
              </Text>
              <Text style={[styles.clerkPickMainTitle, { fontSize: fs(30) }]}>
                {clerkPickView === 'grid'
                  ? currentLang === 'zh-TW'
                    ? '請點您要問的問題'
                    : 'Tap the question you want to ask'
                  : currentLang === 'zh-TW'
                  ? '請輸入金額'
                  : 'Please enter the amount'}
              </Text>
            </View>

            {clerkPickView === 'grid' ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.clerkPickGrid}
              >
                <View style={styles.clerkPickCell}>
                  <TouchableOpacity
                    style={[styles.clerkPickTile, styles.clerkPickAmountTile]}
                    onPress={() => setClerkPickView('amount')}
                  >
                    <Ionicons name="keypad-outline" size={fs(24)} color={THEME.orange} />
                    <Text
                      style={[
                        styles.clerkPickTileText,
                        { color: THEME.orange, fontSize: fs(22) },
                      ]}
                    >
                      {currentLang === 'zh-TW' ? '輸入金額' : 'Enter Amount'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {prioritizedCards.map((card) => (
                  <View key={card.id} style={styles.clerkPickCell}>
                    <TouchableOpacity
                      style={styles.clerkPickTile}
                      onPress={() => handleClerkPickCard(card)}
                    >
                      <Text
                        style={[styles.clerkPickTileText, { fontSize: fs(21) }]}
                        numberOfLines={2}
                      >
                        {card.question?.['zh-TW'] || card.question?.[currentLang]}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.clerkKeypadContainer}>
                <View style={styles.clerkKeypadDisplay}>
                  <Text style={[styles.clerkKeypadCurrency, { fontSize: fs(20) }]}>NT$</Text>
                  <Text
                    style={[styles.clerkKeypadFigure, { fontSize: fs(52) }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {clerkDigits ? Number(clerkDigits).toLocaleString('zh-TW') : '0'}
                  </Text>
                  <Text style={[styles.clerkKeypadCurrency, { fontSize: fs(20) }]}>元</Text>
                </View>

                <View style={styles.clerkKeypadGrid}>
                  {KEYPAD_KEYS.map((k) => (
                    <View key={k} style={styles.clerkKeyCell}>
                      <TouchableOpacity
                        style={styles.clerkKeyBtn}
                        onPress={() => pressKeypadDigit(k)}
                      >
                        <Text
                          style={[
                            styles.clerkKeyBtnText,
                            { fontSize: k === 'clear' ? fs(18) : fs(26) },
                          ]}
                        >
                          {k === 'del' ? '⌫' : k === 'clear' ? '清除' : k}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    style={styles.clerkKeypadGhostBtn}
                    onPress={() => {
                      setClerkPickView('grid');
                      setClerkDigits('');
                    }}
                  >
                    <Text style={{ color: '#FFF', fontSize: fs(18), fontWeight: '600' }}>
                      {currentLang === 'zh-TW' ? '回到問題' : 'Back'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={!clerkDigits}
                    style={[
                      styles.clerkKeypadSubmitBtn,
                      !clerkDigits && { opacity: 0.4 },
                    ]}
                    onPress={() => handleClerkSubmitAmount(Number(clerkDigits))}
                  >
                    <Text style={{ color: '#000', fontSize: fs(18), fontWeight: '800' }}>
                      {currentLang === 'zh-TW' ? '給客人確認' : 'Send to Customer'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.clerkPickUserCancelBar,
              { paddingBottom: Math.max(insets.bottom, 14) },
            ]}
            onPress={() => {
              setIsClerkPickOpen(false);
              setClerkPickView('grid');
              setClerkDigits('');
            }}
          >
            <Text style={[styles.clerkPickUserCancelText, { fontSize: fs(16) }]}>
              ↓↑ {currentLang === 'zh-TW' ? '取消，回到我這面' : 'Cancel, back to my side'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Modal: Type to Clerk */}
      <Modal visible={isTypeToClerkOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.typeModalCard,
              { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border },
            ]}
          >
            <Text
              style={[
                styles.settingsModalTitle,
                { color: THEME.text, fontSize: fs(20), marginBottom: 8 },
              ]}
            >
              ✏️ {currentLang === 'zh-TW' ? '打字給對方看' : 'Type to Clerk'}
            </Text>
            {!!lastHeardQuestion && (
              <Text style={{ color: THEME.orange, fontSize: fs(13), marginBottom: 8 }}>
                ✨ 將自動記憶為「{lastHeardQuestion}」的常選回答
              </Text>
            )}
            <TextInput
              style={[
                styles.inputField,
                {
                  backgroundColor: THEME.bg,
                  color: THEME.text,
                  borderColor: THEME.border,
                  fontSize: fs(17),
                  minHeight: 80,
                },
              ]}
              placeholder={currentLang === 'zh-TW' ? '輸入回答文字或電話號碼...' : 'Type text...'}
              placeholderTextColor={THEME.textMuted}
              value={customTypeInput}
              onChangeText={setCustomTypeInput}
              multiline
              autoFocus
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleTypeToClerkSubmit}>
              <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>
                🔊 {currentLang === 'zh-TW' ? '顯示、發音並記憶' : 'Show, Speak & Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.closeBtn, { marginTop: 8 }]}
              onPress={() => setIsTypeToClerkOpen(false)}
            >
              <Text style={[styles.closeBtnText, { color: THEME.textMuted, fontSize: fs(15) }]}>
                {currentLang === 'zh-TW' ? '關閉 (Close)' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Manual Add New Question & Answer */}
      <Modal visible={isAddQaOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.typeModalCard,
              { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border },
            ]}
          >
            <Text
              style={[
                styles.settingsModalTitle,
                { color: THEME.text, fontSize: fs(20), marginBottom: 6 },
              ]}
            >
              ✨ {currentLang === 'zh-TW' ? '新增問題與回答' : 'Save New Question & Answer'}
            </Text>
            <Text style={{ color: THEME.textMuted, fontSize: fs(13), marginBottom: 12 }}>
              {currentLang === 'zh-TW'
                ? `儲存至「${activeVenue.name['zh-TW']}」，下次店員問起時會自動跳出建議：`
                : 'Saved to this situation and suggested automatically next time:'}
            </Text>

            <Text style={{ color: THEME.text, fontSize: fs(14), marginBottom: 4, fontWeight: '700' }}>
              {currentLang === 'zh-TW' ? '1. 店員問的問題 (關鍵句)：' : '1. Clerk Question:'}
            </Text>
            <TextInput
              style={[
                styles.inputField,
                {
                  backgroundColor: THEME.bg,
                  color: THEME.text,
                  borderColor: THEME.border,
                  fontSize: fs(16),
                  minHeight: 48,
                },
              ]}
              placeholder={currentLang === 'zh-TW' ? '例如：要不要加辣？ / 刷條碼嗎？' : 'e.g. Spicy?'}
              placeholderTextColor={THEME.textMuted}
              value={newQuestionInput}
              onChangeText={setNewQuestionInput}
            />

            <Text style={{ color: THEME.text, fontSize: fs(14), marginBottom: 4, fontWeight: '700' }}>
              {currentLang === 'zh-TW' ? '2. 我的預設回答：' : '2. My Preferred Answer:'}
            </Text>
            <TextInput
              style={[
                styles.inputField,
                {
                  backgroundColor: THEME.bg,
                  color: THEME.text,
                  borderColor: THEME.border,
                  fontSize: fs(16),
                  minHeight: 48,
                },
              ]}
              placeholder={currentLang === 'zh-TW' ? '例如：小辣，謝謝' : 'e.g. Mild spicy, thanks'}
              placeholderTextColor={THEME.textMuted}
              value={newAnswerInput}
              onChangeText={setNewAnswerInput}
            />

            <TouchableOpacity style={styles.sendBtn} onPress={handleManualSaveQA}>
              <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>
                💾 {currentLang === 'zh-TW' ? '儲存至本場景並同步雲端' : 'Save & Sync for Future'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.closeBtn, { marginTop: 8 }]}
              onPress={() => setIsAddQaOpen(false)}
            >
              <Text style={[styles.closeBtnText, { color: THEME.textMuted, fontSize: fs(15) }]}>
                {currentLang === 'zh-TW' ? '取消' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Quick Font & Animated Day/Night Switch in Counter Mode ("Aa") */}
      <Modal visible={isSettingsOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.typeModalCard,
              { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border },
            ]}
          >
            <Text
              style={[
                styles.settingsModalTitle,
                { color: THEME.text, fontSize: fs(20), marginBottom: 12 },
              ]}
            >
              {currentLang === 'zh-TW' ? '字體大小調整' : 'Adjust Font Size'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {FONT_SCALE_OPTIONS.map((f) => (
                <TouchableOpacity
                  key={f.label}
                  style={[
                    styles.fontBtn,
                    { backgroundColor: THEME.bg, borderColor: THEME.border },
                    fontScale === f.val && {
                      backgroundColor: THEME.orange,
                      borderColor: THEME.orange,
                    },
                  ]}
                  onPress={() => persistFontScale(f.val)}
                >
                  <Text
                    style={[
                      styles.fontBtnText,
                      { color: THEME.text, fontSize: fs(14) },
                      fontScale === f.val && { color: '#000', fontWeight: '800' },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View
              style={[
                styles.themeShowcaseCard,
                {
                  backgroundColor: THEME.bg,
                  borderColor: THEME.border,
                  marginBottom: 16,
                  padding: 14,
                },
              ]}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: THEME.text, fontSize: fs(16), fontWeight: '800' }}>
                  {themeMode === 'dark'
                    ? currentLang === 'zh-TW'
                      ? '🌙 星夜深色'
                      : '🌙 Night Mode'
                    : currentLang === 'zh-TW'
                    ? '☀️ 晴空淺色'
                    : '☀️ Day Mode'}
                </Text>
                <Text style={{ color: THEME.textMuted, fontSize: fs(12), marginTop: 2 }}>
                  {currentLang === 'zh-TW' ? '點擊切換日夜背景' : 'Toggle Day / Night sky'}
                </Text>
              </View>
              <DayNightScenerySwitch themeMode={themeMode} onToggle={toggleThemeMode} />
            </View>

            <TouchableOpacity style={styles.sendBtn} onPress={() => setIsSettingsOpen(false)}>
              <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>
                {currentLang === 'zh-TW' ? '完成' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>      {/* Modal: Receipt Number Call Watcher (叫號提醒) */}
      <Modal visible={isNumberModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.typeModalCard,
              { backgroundColor: THEME.surfaceSolid, borderColor: THEME.border },
            ]}
          >
            <Text
              style={[
                styles.settingsModalTitle,
                { color: THEME.text, fontSize: fs(20), marginBottom: 6 },
              ]}
            >
              🔔 {currentLang === 'zh-TW' ? '號碼牌叫號提醒' : 'Order Number Watcher'}
            </Text>
            <Text style={{ color: THEME.textMuted, fontSize: fs(13), marginBottom: 12 }}>
              {currentLang === 'zh-TW'
                ? '輸入您的取餐號碼（例如：68），開啟語音監聽後，店員叫號時畫面會自動閃爍提醒您：'
                : 'Enter your receipt number (e.g., 68). When the clerk calls it, your screen will flash:'}
            </Text>
            <TextInput
              style={[
                styles.inputField,
                {
                  backgroundColor: THEME.bg,
                  color: THEME.text,
                  borderColor: THEME.border,
                  fontSize: fs(24),
                  fontWeight: '900',
                  textAlign: 'center',
                },
              ]}
              placeholder="例如：68"
              placeholderTextColor={THEME.textMuted}
              keyboardType="numeric"
              value={watchNumber}
              onChangeText={(t) => {
                setWatchNumber(t.trim());
                setNumberCalledAlert(false);
              }}
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => {
                setIsNumberModalOpen(false);
                if (watchNumber && !isLiveActive) {
                  toggleLiveListening();
                }
              }}
            >
              <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>
                {watchNumber
                  ? currentLang === 'zh-TW'
                    ? `✓ 開始監聽 #${watchNumber} 號`
                    : `✓ Watch #${watchNumber}`
                  : currentLang === 'zh-TW'
                  ? '完成'
                  : 'Done'}
              </Text>
            </TouchableOpacity>
            {!!watchNumber && (
              <TouchableOpacity
                style={[styles.closeBtn, { marginTop: 8 }]}
                onPress={() => {
                  setWatchNumber('');
                  setNumberCalledAlert(false);
                  setIsNumberModalOpen(false);
                }}
              >
                <Text style={[styles.closeBtnText, { color: THEME.danger, fontSize: fs(14) }]}>
                  {currentLang === 'zh-TW' ? '清除號碼' : 'Clear Number'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  auroraOrb: {
    position: 'absolute',
    ...(Platform.OS === 'web' ? { filter: 'blur(60px)' } : {}),
  },
  // 🌞🌚 Animated Day / Night Scenery Switch Styles
  scenerySwitchTrack: {
    width: 126,
    height: 48,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  sceneryTrackDecorLeft: {
    position: 'absolute',
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sceneryTrackDecorRight: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sceneryTrackLabelDark: {
    color: '#D8E2FF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sceneryTrackLabelLight: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  scenerySwitchThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  themeShowcaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 10,
    paddingHorizontal: 16,
  },
  brandBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeTitleLogo: {
    fontWeight: '800',
    letterSpacing: -0.4,
    fontFamily: FONT_FAMILY,
  },
  cloudDotBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2EC4B6',
  },
  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontWeight: '700' },
  toastBanner: {
    backgroundColor: 'rgba(46, 196, 182, 0.18)',
    borderWidth: 1,
    borderColor: '#2EC4B6',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  toastBannerText: {
    color: '#2EC4B6',
    fontWeight: '700',
  },
  satelliteDropdownContainer: { paddingHorizontal: 16, marginBottom: 14, zIndex: 100 },
  satelliteEditorCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  satelliteFoundLabel: { color: '#2EC4B6', fontWeight: '700' },
  nearbyPulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2EC4B6' },
  rescanSmallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  candidateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  candidateChipActive: {
    backgroundColor: '#FF9F1C',
    borderColor: '#FF9F1C',
  },
  candidateChipText: {
    fontWeight: '600',
  },
  editableLocationInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
    marginBottom: 10,
  },
  templateTypeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  templateTypeChipActive: {
    backgroundColor: '#FF9F1C',
    borderColor: '#FF9F1C',
  },
  templateTypeChipText: {
    fontWeight: '600',
  },
  saveLocationConfirmBtn: {
    backgroundColor: '#FF9F1C',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveLocationConfirmBtnText: {
    color: '#000',
    fontWeight: '800',
  },
  dismissPillBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  mainScroll: { flex: 1 },
  greetingSection: { marginBottom: 16, marginTop: 6, paddingHorizontal: 16 },
  greetingTitle: {
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
    fontFamily: FONT_FAMILY,
  },
  greetingSub: {
    fontWeight: '500',
    fontFamily: FONT_FAMILY,
  },
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    marginHorizontal: 16,
    shadowColor: '#060B1E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  heroImageCentered: { width: '100%', height: 180, resizeMode: 'cover' },
  heroImageBadge: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    backgroundColor: 'rgba(8, 11, 26, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroContent: { padding: 20, width: '100%' },
  heroTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily: FONT_FAMILY,
  },
  startModeBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    width: '100%',
    shadowColor: '#FF9F1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  startModeBtnText: {
    color: '#000',
    fontWeight: '800',
    fontFamily: FONT_FAMILY,
  },
  heroHint: {
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  carouselSection: { paddingLeft: 16 },
  carouselTitle: {
    fontWeight: '700',
    marginBottom: 14,
    fontFamily: FONT_FAMILY,
  },
  carouselScroll: { gap: 14, paddingBottom: 20, paddingRight: 16, paddingTop: 4 },
  carouselItem: { alignItems: 'center', width: 84 },
  carouselImgRing: {
    padding: 3,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  carouselItemImg: {
    width: 68,
    height: 68,
    borderRadius: 15,
  },
  carouselItemText: {
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
    textAlign: 'center',
  },
  manageVenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  manageVenueDeleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 77, 109, 0.15)',
  },

  // 🟠 TOP 180° CLERK SPLIT PANEL
  splitTop: {
    flex: 0.94,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitTopInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 12,
    transform: [{ rotate: '180deg' }],
  },
  clerkTopActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  clerkOfflinePickPill: {
    flex: 1,
    backgroundColor: '#FF9F1C',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkOfflinePickText: {
    color: '#000000',
    fontWeight: '800',
    fontFamily: FONT_FAMILY,
  },
  clerkRoundSpeakBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkMainMessageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  clerkStatusLabel: {
    color: '#FF9F1C',
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  clerkDefaultHeadline: {
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    fontFamily: FONT_FAMILY,
  },
  clerkDefaultSub: {
    fontWeight: '600',
    color: '#9BA8D2',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  clerkMainMessageLarge: {
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  clerkBarcodeCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    borderWidth: 2,
    borderColor: '#FF9F1C',
  },
  clerkBarcodeBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkBarcodeCodeText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 3,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  clerkSecondaryMessage: {
    fontWeight: '600',
    color: '#9BA8D2',
    marginTop: 6,
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  clerkFlipEdgeHint: {
    color: '#6E7A9E',
    fontWeight: '600',
    paddingBottom: 4,
  },
  splitAmberDivider: { height: 3, backgroundColor: '#FF9F1C' },

  // ⚫ BOTTOM USER SPLIT PANEL
  splitBottom: {
    flex: 1.25,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  bottomHeaderGroup: { marginBottom: 8, zIndex: 10 },
  bottomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  venueDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  venueDropdownText: {
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  offlineModePill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  offlineModePillText: {
    color: '#FF9F1C',
    fontWeight: '700',
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 7,
  },
  liveStatusText: {
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  smallSettingsBtn: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  smartReplyPillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF9F1C',
    borderRadius: 999,
    overflow: 'hidden',
  },
  smartReplyMainTap: {
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
  },
  smartReplySpeakerTap: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 1,
  },
  smartReplyBtnText: { fontWeight: '700' },
  liveSubtitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  liveSubtitleText: {
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  subtitleSpeakerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageActiveCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 14,
  },
  stageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stageBackBtn: { paddingVertical: 4, paddingRight: 10 },
  stageBackText: { fontWeight: '600' },
  stageCardCaption: { fontWeight: '600' },
  stageSpeakSmallBtn: {
    padding: 7,
    borderRadius: 10,
  },
  stageQuestionHeadline: {
    fontWeight: '800',
    marginBottom: 14,
  },
  stageOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  stageOptionCell: { padding: 4 },
  stageOptionTile: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageOptionTileSelected: {
    backgroundColor: '#FF9F1C',
    borderColor: '#FF9F1C',
  },
  stageOptionTileText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  stageOptionTileSub: {
    marginTop: 4,
    textAlign: 'center',
  },
  amountDisplayWell: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  amountCurrencyText: { fontWeight: '600' },
  amountFigureText: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  amountConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionsList: { flex: 1 },
  sectionListHeader: {
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  addCustomQaBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardGroupBox: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardQuestionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  cardQuestionHeaderText: {
    color: '#FF9F1C',
    fontWeight: '800',
  },
  deleteCardSmallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 77, 109, 0.15)',
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  questionTextCol: { flex: 1, gap: 2, paddingRight: 8 },
  questionTitle: {
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  questionSub: { fontFamily: FONT_FAMILY },
  rowSpeakerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionArrow: {},
  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 4,
  },
  actionBtnSecondary: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionBtnSecondaryText: {
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  actionBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionBtnPrimaryText: {
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  clerkPickModalRoot: { flex: 1, backgroundColor: '#080B1A' },
  clerkPickRotatedArea: {
    flex: 1,
    transform: [{ rotate: '180deg' }],
    paddingHorizontal: 16,
  },
  clerkPickHeader: { marginBottom: 14, paddingHorizontal: 4 },
  clerkPickOrangeSub: { color: '#FF9F1C', fontWeight: '700', marginBottom: 4 },
  clerkPickMainTitle: { color: '#FFFFFF', fontWeight: '900' },
  clerkPickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    paddingBottom: 24,
  },
  clerkPickCell: { width: '50%', padding: 6 },
  clerkPickTile: {
    height: 100,
    backgroundColor: '#151D3D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(165, 185, 255, 0.22)',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  clerkPickAmountTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderColor: '#FF9F1C',
    borderWidth: 1.5,
  },
  clerkPickTileText: { color: '#FFFFFF', fontWeight: '700' },
  clerkKeypadContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  clerkKeypadDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#151D3D',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  clerkKeypadCurrency: { color: '#9BA8D2', fontWeight: '600' },
  clerkKeypadFigure: { color: '#FFFFFF', fontWeight: '900', fontVariant: ['tabular-nums'] },
  clerkKeypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  clerkKeyCell: { width: '33.333%', padding: 4 },
  clerkKeyBtn: {
    minHeight: 58,
    backgroundColor: '#151D3D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(165, 185, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkKeyBtnText: { color: '#FFFFFF', fontWeight: '700', fontVariant: ['tabular-nums'] },
  clerkKeypadGhostBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(165, 185, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkKeypadSubmitBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: '#FF9F1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkPickUserCancelBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(165, 185, 255, 0.22)',
    paddingTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#080B1A',
  },
  clerkPickUserCancelText: { color: '#9BA8D2', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 24, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsModalCardFull: {
    width: '100%',
    height: '100%',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  settingsModalTitle: {
    fontWeight: '800',
    fontFamily: FONT_FAMILY,
  },
  settingsSectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
  },
  fontBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  fontBtnText: { fontWeight: '600' },
  typeModalCard: {
    width: '90%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
  },
  langOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  langOptionText: { fontFamily: FONT_FAMILY },
  settingsDivider: { height: 1, marginVertical: 20 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingRowLabel: { fontWeight: '500' },
  toggleSwitch: {
    width: 48,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#4CC9F0',
    borderColor: '#4CC9F0',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#9BA8D2',
  },
  toggleThumbActive: {
    backgroundColor: '#FFF',
    transform: [{ translateX: 22 }],
  },
  closeBtn: { paddingVertical: 12, alignItems: 'center' },
  closeBtnText: {
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  inputField: {
    width: '100%',
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  sendBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FF9F1C',
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#000',
    fontWeight: '800',
    fontFamily: FONT_FAMILY,
  },
  sosCardFull: { backgroundColor: '#FF4D6D', borderRadius: 22, padding: 24 },
  sosCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sosTitle: { color: '#FFF', fontWeight: '800', fontFamily: FONT_FAMILY },
  sosInfoBox: {
    backgroundColor: '#C9184A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  sosInfoRow: { flexDirection: 'row', marginBottom: 6 },
  sosTextKey: { color: 'rgba(255,255,255,0.7)', width: 60 },
  sosTextValue: { color: '#FFF', fontWeight: '700' },
  sosQuote: {
    color: '#FFF',
    marginTop: 12,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  sosSpeakBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  sosSpeakBtnText: { color: '#FF4D6D', fontWeight: '800' },
  sosCloseBtn: { paddingVertical: 12, alignItems: 'center' },
  sosCloseBtnText: { color: '#FFF', fontWeight: '600' },
});

export default CounterConversationScreen;






