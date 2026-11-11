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
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const THEME = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceLight: '#2C2C2E',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  orange: '#FF9500',
  danger: '#FF3B30',
  success: '#34C759',
  translateAccent: '#0A84FF',
  border: '#38383A',
  fontFamily:
    Platform.OS === 'web'
      ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      : undefined,
};

export type SupportedLang = 'en-US' | 'zh-TW';

const STORAGE_KEYS = {
  VENUES: 'mochi_custom_venues_v3',
  CARDS: 'mochi_custom_cards_v3',
  WALLPAPERS: 'mochi_wallpapers_v3',
  FONT_SCALE: 'mochi_font_scale_v3',
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

const DEFAULT_STORES_DATA = [
  {
    id: 'cvs',
    name: { 'zh-TW': '便利商店', 'en-US': 'Convenience Store' },
    short: { 'zh-TW': '便利商店', 'en-US': '7-Eleven / CVS' },
    emoji: '🏪',
    coverImage: 'https://images.unsplash.com/photo-1601599561096-f87c95fff1e9?w=1200',
  },
  {
    id: 'drink',
    name: { 'zh-TW': '咖啡・飲料店', 'en-US': 'Cafe & Drinks' },
    short: { 'zh-TW': '咖啡飲料', 'en-US': 'Cafe' },
    emoji: '🧋',
    coverImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200',
  },
  {
    id: 'breakfast',
    name: { 'zh-TW': '早餐店', 'en-US': 'Breakfast Shop' },
    short: { 'zh-TW': '早餐店', 'en-US': 'Breakfast' },
    emoji: '🥪',
    coverImage: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1200',
  },
  {
    id: 'pharmacy',
    name: { 'zh-TW': '藥局・診所', 'en-US': 'Pharmacy & Clinic' },
    short: { 'zh-TW': '藥局診所', 'en-US': 'Pharmacy' },
    emoji: '💊',
    coverImage: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200',
  },
  {
    id: 'buffet',
    name: { 'zh-TW': '自助餐・便當', 'en-US': 'Bento & Buffet' },
    short: { 'zh-TW': '自助餐便當', 'en-US': 'Buffet' },
    emoji: '🍱',
    coverImage: 'https://images.unsplash.com/photo-1548943487-a2e4b43b5930?w=1200',
  },
  {
    id: 'university',
    name: { 'zh-TW': '校園・圖書館', 'en-US': 'Campus & Library' },
    short: { 'zh-TW': '校園圖書館', 'en-US': 'Campus' },
    emoji: '🏫',
    coverImage: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200',
  },
  {
    id: 'salon',
    name: { 'zh-TW': '美髮店', 'en-US': 'Hair Salon' },
    short: { 'zh-TW': '美髮店', 'en-US': 'Salon' },
    emoji: '✂️',
    coverImage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200',
  },
  {
    id: 'other',
    name: { 'zh-TW': '一般商店', 'en-US': 'General Place' },
    short: { 'zh-TW': '一般商店', 'en-US': 'General' },
    emoji: '🏬',
    coverImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
  },
];

// 📋 COMPLETE TAIWAN COUNTER CARDS (With Clerk Question Titles for 180° Offline Clerk Pick Grid & User Answer Grid)
const DEFAULT_CARDS_DATA = [
  // Cafe & Drink Specific (Matches Image 3 Offline Clerk Grid)
  {
    id: 'temp_choice',
    stores: ['drink', 'cvs', 'breakfast'],
    priority: 1,
    question: { 'zh-TW': '冰的還是熱的？', 'en-US': 'Iced or Hot?' },
    keywords: ['冰的', '熱的', '溫的', '冰塊', 'iced', 'hot', 'warm'],
    options: [
      { labels: { 'zh-TW': '冰的', 'en-US': 'Iced' }, subLabels: { 'zh-TW': '冷飲', 'en-US': 'Cold drink' }, tts: '冰的，謝謝' },
      { labels: { 'zh-TW': '熱的', 'en-US': 'Hot' }, subLabels: { 'zh-TW': '熱飲', 'en-US': 'Hot drink' }, tts: '熱的，謝謝' },
      { labels: { 'zh-TW': '溫的', 'en-US': 'Warm' }, subLabels: { 'zh-TW': '溫飲', 'en-US': 'Warm drink' }, tts: '溫的，謝謝' },
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
      { labels: { 'zh-TW': '大杯', 'en-US': 'Large' }, subLabels: { 'zh-TW': '大杯容量', 'en-US': 'Large cup' }, tts: '大杯，謝謝' },
      { labels: { 'zh-TW': '中杯', 'en-US': 'Medium' }, subLabels: { 'zh-TW': '中杯容量', 'en-US': 'Medium cup' }, tts: '中杯，謝謝' },
    ],
  },
  {
    id: 'toppings',
    stores: ['drink'],
    priority: 1,
    question: { 'zh-TW': '要加料嗎？', 'en-US': 'Any toppings?' },
    keywords: ['加料', '珍珠', '波霸', '椰果', '仙草', '布丁', 'topping', 'boba', 'pearl'],
    options: [
      { labels: { 'zh-TW': '不用加料', 'en-US': 'No Toppings' }, subLabels: { 'zh-TW': '原味即可', 'en-US': 'Plain drink' }, tts: '不用加料，謝謝' },
      { labels: { 'zh-TW': '加珍珠', 'en-US': 'Add Boba / Pearls' }, subLabels: { 'zh-TW': '波霸/珍珠', 'en-US': 'Tapioca pearls' }, tts: '我要加珍珠，謝謝' },
      { labels: { 'zh-TW': '加椰果', 'en-US': 'Add Coconut Jelly' }, subLabels: { 'zh-TW': '椰果配料', 'en-US': 'Nata de coco' }, tts: '我要加椰果，謝謝' },
    ],
  },
  {
    id: 'second_cup',
    stores: ['drink', 'cvs'],
    priority: 1,
    question: { 'zh-TW': '第二杯半價要嗎？', 'en-US': '2nd cup half price?' },
    keywords: ['第二杯', '半價', '兩杯', '優惠', '寄杯', 'second cup', 'discount'],
    options: [
      { labels: { 'zh-TW': '不用，一杯就好', 'en-US': 'No, just one' }, subLabels: { 'zh-TW': '買一杯即可', 'en-US': 'Single cup only' }, tts: '不用，一杯就好，謝謝' },
      { labels: { 'zh-TW': '好，我要兩杯', 'en-US': 'Yes, two cups' }, subLabels: { 'zh-TW': '搭配優惠', 'en-US': 'Take the deal' }, tts: '好，那我要兩杯，謝謝' },
    ],
  },
  {
    id: 'heat',
    stores: ['cvs', 'breakfast'],
    priority: 1,
    question: { 'zh-TW': '要加熱嗎？', 'en-US': 'Heat it up?' },
    keywords: ['加熱', '微波', '熱一下', '要熱嗎', '烤一下', 'heat', 'microwave', 'warm up'],
    options: [
      { labels: { 'zh-TW': '要加熱', 'en-US': 'Yes, heat it up' }, subLabels: { 'zh-TW': '請幫我微波加熱', 'en-US': 'Microwave please' }, tts: '要加熱，謝謝' },
      { labels: { 'zh-TW': '不用加熱', 'en-US': 'No need' }, subLabels: { 'zh-TW': '直接拿走', 'en-US': 'Keep as is' }, tts: '不用加熱，謝謝' },
    ],
  },
  {
    id: 'rice',
    stores: ['buffet'],
    priority: 1,
    question: { 'zh-TW': '白飯要多少？', 'en-US': 'How much rice?' },
    keywords: ['白飯', '飯要', '半碗', '飯量', '紫米', 'rice'],
    options: [
      { labels: { 'zh-TW': '正常飯', 'en-US': 'Normal Rice' }, subLabels: { 'zh-TW': '標準飯量', 'en-US': 'Standard portion' }, tts: '飯正常，謝謝' },
      { labels: { 'zh-TW': '少飯', 'en-US': 'Less Rice' }, subLabels: { 'zh-TW': '半碗飯', 'en-US': 'Half portion' }, tts: '飯少一點，謝謝' },
      { labels: { 'zh-TW': '不要飯', 'en-US': 'No Rice' }, subLabels: { 'zh-TW': '只要菜', 'en-US': 'Dishes only' }, tts: '不要飯，謝謝' },
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

  // Universal Checkout & Counter Questions (Matches Images 2 & 3)
  {
    id: 'dinein',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '內用還是外帶？', 'en-US': 'For here or to go?' },
    keywords: ['內用', '外帶', '這裡吃', '帶走', 'to go', 'dine in', 'for here'],
    options: [
      { labels: { 'zh-TW': '內用', 'en-US': 'Dine In' }, subLabels: { 'zh-TW': '在店裡吃', 'en-US': 'Eat here' }, tts: '內用，謝謝' },
      { labels: { 'zh-TW': '外帶', 'en-US': 'Takeout' }, subLabels: { 'zh-TW': '帶走', 'en-US': 'To go' }, tts: '外帶，謝謝' },
    ],
  },
  {
    id: 'member',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '有集點或會員嗎？', 'en-US': 'Membership or points?' },
    keywords: ['會員', '集點', '電話', '號碼', '統編', 'member', 'points', 'phone'],
    options: [
      { labels: { 'zh-TW': '沒有會員', 'en-US': 'No Membership' }, subLabels: { 'zh-TW': '不用集點', 'en-US': 'Skip points' }, tts: '沒有會員，謝謝' },
      { labels: { 'zh-TW': '有，掃條碼', 'en-US': 'Yes, scan barcode' }, subLabels: { 'zh-TW': '出示手機會員', 'en-US': 'Show member app' }, tts: '有會員，請幫我掃條碼' },
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
      { labels: { 'zh-TW': '手機條碼', 'en-US': 'Phone Barcode' }, subLabels: { 'zh-TW': '存入手機載具', 'en-US': 'Scan carrier barcode' }, tts: '有載具，請掃手機條碼' },
      { labels: { 'zh-TW': '紙本發票', 'en-US': 'Paper Receipt' }, subLabels: { 'zh-TW': '直接印出來', 'en-US': 'Print paper receipt' }, tts: '沒有載具，請印紙本發票' },
      { labels: { 'zh-TW': '不用', 'en-US': 'No need' }, subLabels: { 'zh-TW': '不用載具', 'en-US': 'No carrier' }, tts: '不用載具，謝謝' },
    ],
  },
  {
    id: 'receipt_print',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '發票要印嗎？', 'en-US': 'Print the receipt?' },
    keywords: ['發票', '要印嗎', '印發票', '明細', '統編', 'receipt', 'print'],
    options: [
      { labels: { 'zh-TW': '要印發票', 'en-US': 'Print Receipt' }, subLabels: { 'zh-TW': '紙本發票', 'en-US': 'Yes, print it' }, tts: '發票要印，謝謝' },
      { labels: { 'zh-TW': '不用印，存載具', 'en-US': 'Save to Carrier' }, subLabels: { 'zh-TW': '掃手機條碼', 'en-US': 'No print, scan barcode' }, tts: '發票不用印，請幫我存載具' },
      { labels: { 'zh-TW': '捐發票 / 不用', 'en-US': 'Donate / No Need' }, subLabels: { 'zh-TW': '不拿紙本發票', 'en-US': 'No paper receipt' }, tts: '發票不用印，謝謝' },
    ],
  },
  {
    id: 'bag',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '需要袋子嗎？', 'en-US': 'Do you need a bag?' },
    keywords: ['袋子', '提袋', '購物袋', '塑膠袋', 'bag', 'plastic bag'],
    options: [
      { labels: { 'zh-TW': '要袋子', 'en-US': 'Need a Bag' }, subLabels: { 'zh-TW': '加購購物袋', 'en-US': 'Buy a bag' }, tts: '我要買一個袋子，謝謝' },
      { labels: { 'zh-TW': '不用袋子', 'en-US': 'No Bag' }, subLabels: { 'zh-TW': '自己拿或自備袋子', 'en-US': 'I have my own' }, tts: '不用袋子，謝謝' },
    ],
  },
  {
    id: 'pay',
    stores: ['*'],
    priority: 2,
    question: { 'zh-TW': '請問怎麼付款？', 'en-US': 'How would you like to pay?' },
    keywords: ['現金', '刷卡', '付款', '支付', '悠遊卡', 'line pay', 'apple pay', 'cash', 'card', 'pay'],
    options: [
      { labels: { 'zh-TW': '付現', 'en-US': 'Cash' }, subLabels: { 'zh-TW': '現金付款', 'en-US': 'Pay with cash' }, tts: '我付現金' },
      { labels: { 'zh-TW': '刷卡 / 行動支付', 'en-US': 'Card / Mobile Pay' }, subLabels: { 'zh-TW': 'Apple Pay / Line Pay', 'en-US': 'Contactless payment' }, tts: '我用刷卡或行動支付' },
      { labels: { 'zh-TW': '悠遊卡', 'en-US': 'EasyCard' }, subLabels: { 'zh-TW': '感應悠遊卡', 'en-US': 'Tap EasyCard' }, tts: '我用悠遊卡付款' },
    ],
  },
];

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'] as const;

export const CounterConversationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [currentLang, setCurrentLang] = useState<SupportedLang>('zh-TW');
  const [isTranslateMode, setIsTranslateMode] = useState(false);
  const [fontScale, setFontScale] = useState(1.0);
  const [isCounterMode, setIsCounterMode] = useState(false);

  const [venues, setVenues] = useState(DEFAULT_STORES_DATA);
  const [activeVenue, setActiveVenue] = useState(DEFAULT_STORES_DATA[0]);
  const [cardsData, setCardsData] = useState(DEFAULT_CARDS_DATA);

  const [customWallpapers, setCustomWallpapers] = useState<Record<string, string>>({});
  const [wallpaperInputUrl, setWallpaperInputUrl] = useState('');

  // Counter Stage States
  const [clerkMessage, setClerkMessage] = useState('');
  const [clerkLabel, setClerkLabel] = useState('');
  const [clerkSub, setClerkSub] = useState('');

  // Active Interactive Card / Amount Confirmation (Matches Image 2 & StagePanels.tsx)
  const [activePromptCard, setActivePromptCard] = useState<any>(null);
  const [chosenOption, setChosenOption] = useState<any>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [amountConfirmed, setAmountConfirmed] = useState<boolean | undefined>(undefined);

  // 180° Offline Clerk Pick Modal States (Matches Image 3 & ClerkPick.tsx)
  const [isClerkPickOpen, setIsClerkPickOpen] = useState(false);
  const [clerkPickView, setClerkPickView] = useState<'grid' | 'amount'>('grid');
  const [clerkDigits, setClerkDigits] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [isTypeToClerkOpen, setIsTypeToClerkOpen] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState('');

  // GPS Detection States
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [nearbyVenueFound, setNearbyVenueFound] = useState<any>(null);
  const autoDetectTimerRef = useRef<any>(null);

  // Live Speech Recognition States
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStreamText, setLiveStreamText] = useState('');
  const [smartReplies, setSmartReplies] = useState<any[]>([]);

  const webRecRef = useRef<any>(null);

  // 💾 PERSISTENCE STORAGE LOADER
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        let savedVenues = null;
        let savedCards = null;
        let savedWallpapers = null;
        let savedScale = null;

        if (Platform.OS === 'web') {
          savedVenues = localStorage.getItem(STORAGE_KEYS.VENUES);
          savedCards = localStorage.getItem(STORAGE_KEYS.CARDS);
          savedWallpapers = localStorage.getItem(STORAGE_KEYS.WALLPAPERS);
          savedScale = localStorage.getItem(STORAGE_KEYS.FONT_SCALE);
        } else {
          savedVenues = await AsyncStorage.getItem(STORAGE_KEYS.VENUES);
          savedCards = await AsyncStorage.getItem(STORAGE_KEYS.CARDS);
          savedWallpapers = await AsyncStorage.getItem(STORAGE_KEYS.WALLPAPERS);
          savedScale = await AsyncStorage.getItem(STORAGE_KEYS.FONT_SCALE);
        }

        if (savedVenues) {
          const parsed = JSON.parse(savedVenues);
          if (Array.isArray(parsed) && parsed.length > 0) setVenues(parsed);
        }
        if (savedCards) {
          const parsed = JSON.parse(savedCards);
          if (Array.isArray(parsed) && parsed.length > 0) setCardsData(parsed);
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
      } catch (e) {
        console.error('Error loading stored configurations:', e);
      }
    };
    loadSavedData();
  }, []);

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
  };

  const saveCustomWallpaper = async () => {
    if (!wallpaperInputUrl.trim()) return;
    const newUrl = wallpaperInputUrl.trim();
    const newWallpapers = { ...customWallpapers, [activeVenue.id]: newUrl };
    setCustomWallpapers(newWallpapers);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEYS.WALLPAPERS, JSON.stringify(newWallpapers));
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.WALLPAPERS, JSON.stringify(newWallpapers));
      }
    } catch (e) {}
    setWallpaperInputUrl('');
  };

  const getActiveCoverImage = () => customWallpapers[activeVenue.id] || activeVenue.coverImage;

  const getVenueShortName = (v: any) => {
    if (!v) return '';
    if (typeof v.short === 'object') return v.short[currentLang] || v.short['zh-TW'];
    return v.short;
  };

  const speakSentence = (text: string, forcedLang?: string) => {
    if (!text) return;
    const cleanText = text.replace(/^[💡🔊\s]+/, '').trim();
    const hasChinese = /[\u4e00-\u9fa5]/.test(cleanText);
    const lang = forcedLang || (hasChinese ? 'zh-TW' : currentLang);

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(cleanText);
      u.lang = lang;
      window.speechSynthesis.speak(u);
    } else {
      Speech.stop();
      Speech.speak(cleanText, { language: lang });
    }
  };

  const learnNewConversationExchange = async (promptHeard: string, userReplyText: string) => {
    if (!promptHeard || !userReplyText || promptHeard.length < 2) return;

    const exists = cardsData.some((c) =>
      c.keywords.some((k: string) => k.toLowerCase() === promptHeard.toLowerCase())
    );
    if (exists) return;

    let enLabels = userReplyText;
    if (currentLang === 'zh-TW') {
      enLabels = await realTranslate(userReplyText, 'zh-TW', 'en-US');
    }

    const newCard = {
      id: `learned_${Date.now()}`,
      stores: [activeVenue.id],
      priority: 1,
      question: { 'zh-TW': promptHeard, 'en-US': promptHeard },
      keywords: [promptHeard.toLowerCase()],
      options: [
        {
          labels: { 'zh-TW': userReplyText, 'en-US': enLabels },
          subLabels: { 'zh-TW': '已儲存對話', 'en-US': 'Learned reply' },
          tts: userReplyText,
        },
      ],
    };

    const updated = [newCard, ...cardsData];
    persistCards(updated);
  };

  const processRecognizedText = async (rawText: string, isFinal: boolean) => {
    if (!rawText.trim()) return;

    let translated = '';
    if (isTranslateMode) {
      setLiveStreamText(rawText + ' ...');
      if (isFinal) {
        const targetLang = currentLang;
        const sourceLang = currentLang === 'en-US' ? 'zh-TW' : 'en-US';
        translated = await realTranslate(rawText, sourceLang, targetLang);
        setLiveStreamText(translated);
      }
    } else {
      setLiveStreamText(rawText);
    }

    const lowerRaw = rawText.toLowerCase();
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
      openCardStage(matchedCard);
    }

    if (triggeredReplies.length === 0 && isFinal && rawText.length > 1) {
      const dynamicAiReplies = await fetchGeminiDynamicReplies(
        rawText,
        activeVenue.name['zh-TW'] || getVenueShortName(activeVenue)
      );
      if (dynamicAiReplies && Array.isArray(dynamicAiReplies)) {
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
  }, [isLiveActive, currentLang, isTranslateMode, activeVenue.id]);

  // 🌐 WEB SPEECH RECOGNITION
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) return;

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = isTranslateMode ? (currentLang === 'en-US' ? 'zh-TW' : 'en-US') : currentLang;

      rec.onresult = async (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          interim += event.results[i][0].transcript;
        }
        const isFinal = event.results[event.results.length - 1]?.isFinal || false;
        processRecognizedText(interim.trim(), isFinal);
      };

      rec.onend = () => {
        if (isLiveActive) {
          try {
            rec.start();
          } catch (e) {}
        }
      };

      webRecRef.current = rec;
      if (isLiveActive) {
        try {
          rec.start();
        } catch (e) {}
      }
    }
  }, [isLiveActive, currentLang, isTranslateMode, activeVenue.id]);

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
          webRecRef.current?.start();
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
          webRecRef.current?.stop();
        } catch (e) {}
      }
      setLiveStreamText('');
      setSmartReplies([]);
    }
  };

  // 🎯 STAGE & CLERK DISPLAY HANDLERS (Matches Images 2 & 3)
  const openCardStage = (card: any) => {
    const qText = card.question?.[currentLang] || card.question?.['zh-TW'] || '';
    setPendingAmount(null);
    setAmountConfirmed(undefined);
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
    openCardStage(card);
  };

  const handleClerkSubmitAmount = (val: number) => {
    setIsClerkPickOpen(false);
    setClerkPickView('grid');
    setClerkDigits('');
    setActivePromptCard(null);
    setChosenOption(null);
    setPendingAmount(val);
    setAmountConfirmed(undefined);
    setClerkLabel(currentLang === 'zh-TW' ? '您輸入的金額' : 'Entered Amount');
    setClerkMessage(`NT$ ${val.toLocaleString('zh-TW')} 元`);
    setClerkSub(currentLang === 'zh-TW' ? '等待客人確認中...' : 'Waiting for confirmation...');
  };

  const handleConfirmAmount = (ok: boolean) => {
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
    const displayToClerk = reply.clerkText || optObj?.tts || optObj?.labels?.['zh-TW'] || reply.text;
    if (optObj?.kind === 'type') {
      setIsTypeToClerkOpen(true);
      return;
    }
    setChosenOption(optObj || reply);
    setClerkLabel(currentLang === 'zh-TW' ? '我的回答' : 'My Answer');
    setClerkMessage(displayToClerk);
    setClerkSub(currentLang === 'zh-TW' ? '請直接對手機說話，或點選問題' : 'Speak to phone or tap a question');
    speakSentence(displayToClerk, 'zh-TW');
    setSmartReplies([]);

    if (
      liveStreamText &&
      liveStreamText.length > 2 &&
      !liveStreamText.includes('請開始說話') &&
      !liveStreamText.includes('Listening')
    ) {
      learnNewConversationExchange(liveStreamText, displayToClerk);
    }
  };

  const resetStageToIdle = () => {
    setActivePromptCard(null);
    setChosenOption(null);
    setPendingAmount(null);
    setAmountConfirmed(undefined);
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

  // 🛰️ ACCURATE OUTDOOR & INDOOR GPS RESOLVER (Fixes false "元智大學" outdoor bug)
  const scanLiveLocation = async () => {
    setIsAutoDetecting(true);
    setNearbyVenueFound(null);
    if (autoDetectTimerRef.current) clearTimeout(autoDetectTimerRef.current);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要定位權限', '請允許定位權限以自動偵測所在商店或地點。');
        setIsAutoDetecting(false);
        return;
      }

      // 1. Try High Accuracy first (for accurate outdoor street/store detection), fallback to Balanced
      let loc: any = null;
      try {
        loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('HIGH_TIMEOUT')), 4500)),
        ]);
      } catch (e) {
        try {
          loc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('BAL_TIMEOUT')), 4000)),
          ]);
        } catch (err2) {
          loc = await Location.getLastKnownPositionAsync();
        }
      }

      if (!loc || !loc.coords) {
        Alert.alert('定位逾時', '無法取得目前 GPS 座標，請確認已開啟定位服務。');
        setIsAutoDetecting(false);
        return;
      }

      const { latitude, longitude } = loc.coords;

      let detectedZh = '';
      let detectedEn = '';
      let detectedType = 'other';

      // 2. Query Overpass OSM for nearest actual store/building within 80m sorted by distance
      try {
        const query = `[out:json][timeout:6];(
          node(around:80,${latitude},${longitude})["name"];
          way(around:80,${latitude},${longitude})["name"];
        );out tags center;`;

        const res = await fetch(
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
        );
        const data = await res.json();

        if (data?.elements?.length > 0) {
          // Sort elements by closest distance to user's actual coordinates
          const withDist = data.elements
            .map((el: any) => {
              const elLat = el.lat ?? el.center?.lat ?? latitude;
              const elLon = el.lon ?? el.center?.lon ?? longitude;
              const dist = Math.hypot(elLat - latitude, elLon - longitude);
              return { ...el, dist };
            })
            .sort((a: any, b: any) => a.dist - b.dist);

          // Prefer commercial shops/amenities over broad campus polygons when outdoors
          const shopMatch =
            withDist.find(
              (el: any) => el.tags?.shop || el.tags?.amenity || el.tags?.brand
            ) || withDist[0];

          detectedZh = shopMatch.tags['name:zh'] || shopMatch.tags.name || '';
          detectedEn = shopMatch.tags['name:en'] || shopMatch.tags['brand:en'] || '';

          const type =
            shopMatch.tags['amenity'] ||
            shopMatch.tags['shop'] ||
            shopMatch.tags['building'] ||
            '';
          if (
            type === 'convenience' ||
            type === 'supermarket' ||
            /7-ELEVEN|全家|FamilyMart|萊爾富|OK超商|全聯/i.test(detectedZh)
          ) {
            detectedType = 'cvs';
          } else if (
            type === 'cafe' ||
            type === 'beverages' ||
            /星巴克|路易莎|咖啡|茶|50嵐|迷客夏|清心|得正|可不可|麻古/i.test(detectedZh)
          ) {
            detectedType = 'drink';
          } else if (/早餐|美而美|麥味登|拉亞|早安|永和豆漿/i.test(detectedZh)) {
            detectedType = 'breakfast';
          } else if (
            type === 'pharmacy' ||
            type === 'hospital' ||
            type === 'clinic' ||
            /藥局|診所|醫院|屈臣氏|康是美/i.test(detectedZh)
          ) {
            detectedType = 'pharmacy';
          } else if (
            type === 'restaurant' ||
            type === 'fast_food' ||
            /便當|自助餐|食堂|餐廳|小吃/i.test(detectedZh)
          ) {
            detectedType = 'buffet';
          } else if (type === 'hairdresser' || /美髮|髮廊|剪髮/i.test(detectedZh)) {
            detectedType = 'salon';
          } else if (type === 'university' || type === 'library' || type === 'school') {
            detectedType = 'university';
          }
        }
      } catch (osmErr) {
        console.warn('Overpass lookup warning:', osmErr);
      }

      // 3. Fallback to OpenStreetMap Nominatim Reverse Geocoding (Works on both Web & Android)
      if (!detectedZh) {
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=zh-TW`,
            { headers: { 'User-Agent': 'MochiVisibleDialogApp/1.0' } }
          );
          const nomData = await nomRes.json();
          const addr = nomData?.address || {};
          detectedZh =
            nomData?.name ||
            addr.shop ||
            addr.amenity ||
            [addr.suburb || addr.city_district || addr.town, addr.road, addr.house_number]
              .filter(Boolean)
              .join('') ||
            '';
        } catch (nomErr) {}
      }

      // 4. Native OS Geocode fallback if still empty
      if (!detectedZh && Platform.OS !== 'web') {
        try {
          const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (rev && rev.length > 0) {
            const a = rev[0];
            detectedZh =
              [a.district || a.city, a.street || a.name, a.streetNumber]
                .filter(Boolean)
                .join('') || '';
          }
        } catch (e) {}
      }

      if (!detectedZh) {
        detectedZh = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }

      if (!detectedEn && detectedZh) {
        detectedEn = await realTranslate(detectedZh, 'zh-TW', 'en-US');
      }

      const baseStore =
        venues.find((s) => s.id === detectedType) ||
        DEFAULT_STORES_DATA.find((s) => s.id === detectedType) ||
        DEFAULT_STORES_DATA[7];

      const newDynamicVenue = {
        id: `loc_${Date.now()}`,
        baseType: detectedType,
        name: {
          'zh-TW': detectedZh,
          'en-US': detectedEn || detectedZh,
        },
        short: {
          'zh-TW': detectedZh.substring(0, 10),
          'en-US': (detectedEn || detectedZh).substring(0, 14),
        },
        emoji: baseStore.emoji || '📍',
        coverImage: baseStore.coverImage,
      };

      setNearbyVenueFound(newDynamicVenue);
      setActiveVenue(newDynamicVenue);

      autoDetectTimerRef.current = setTimeout(() => {
        setNearbyVenueFound(null);
      }, 15000);
    } catch (e) {
      console.error('GPS Detection Error:', e);
      Alert.alert('定位失敗', '無法取得目前座標，請確認網路與定位服務正常。');
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleAddLocationAsSituation = async (venueToAdd: any) => {
    if (!venueToAdd) return;
    if (autoDetectTimerRef.current) clearTimeout(autoDetectTimerRef.current);

    const exists = venues.some((v) => v.name['zh-TW'] === venueToAdd.name['zh-TW']);
    let updatedVenues = [...venues];

    if (!exists) {
      updatedVenues = [venueToAdd, ...venues];
      await persistVenues(updatedVenues);
    }

    setActiveVenue(venueToAdd);
    setNearbyVenueFound(null);
    Alert.alert(
      '已加入場景 (Added)',
      `${venueToAdd.name[currentLang] || venueToAdd.name['zh-TW']} 已儲存至場景選單。`
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
      setClerkLabel(currentLang === 'zh-TW' ? '我打字跟您說' : 'Typed Message');
      setClerkMessage(finalSpeech);
      setClerkSub(currentLang === 'zh-TW' ? '請直接對手機說話，或點選問題' : 'Please speak or tap a question');
      speakSentence(finalSpeech, speechLang);

      if (
        liveStreamText &&
        liveStreamText.length > 2 &&
        !liveStreamText.includes('請開始說話')
      ) {
        learnNewConversationExchange(liveStreamText, finalSpeech);
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
    return valid.sort((a, b) => (a.priority || 2) - (b.priority || 2));
  };

  // Dynamic font size helper
  const fs = (base: number) => Math.round(base * fontScale);

  // ============================================================================
  // 🏠 HOME SCREEN (When not in Counter Split Mode)
  // ============================================================================
  if (!isCounterMode) {
    return (
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {/* Top Navigation — Branded as 看得見的對話 / Mochi */}
        <View style={styles.homeHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: fs(20) }}>💬</Text>
            <Text style={[styles.homeTitleLogo, { fontSize: fs(20) }]}>
              {currentLang === 'zh-TW' ? '看得見的對話' : 'Mochi'}
            </Text>
          </View>

          <View style={styles.topRightControls}>
            <TouchableOpacity onPress={scanLiveLocation} style={styles.iconBtn}>
              {isAutoDetecting ? (
                <ActivityIndicator size="small" color={THEME.orange} />
              ) : (
                <Text style={[styles.iconText, { fontSize: fs(18) }]}>🛰️</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsTranslateMode(!isTranslateMode)}
              style={[
                styles.iconBtn,
                isTranslateMode && {
                  backgroundColor: 'rgba(10, 132, 255, 0.2)',
                  borderColor: THEME.translateAccent,
                },
              ]}
            >
              <Text
                style={[
                  styles.iconText,
                  { fontSize: fs(15) },
                  isTranslateMode && { color: THEME.translateAccent, fontWeight: '700' },
                ]}
              >
                A/文
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={styles.iconBtn}>
              <Text style={[styles.iconText, { fontSize: fs(18) }]}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🛰️ SATELLITE DETECTED VENUE PILL */}
        {nearbyVenueFound && (
          <View style={styles.satelliteDropdownContainer}>
            <View style={styles.satelliteResultCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={styles.nearbyPulseDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.satelliteFoundLabel, { fontSize: fs(12) }]}>
                    {currentLang === 'zh-TW' ? '目前定位地點' : 'Detected Location'}
                  </Text>
                  <Text
                    style={[styles.satelliteFoundName, { fontSize: fs(15) }]}
                    numberOfLines={1}
                  >
                    {nearbyVenueFound.name[currentLang] || nearbyVenueFound.name['zh-TW']}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <TouchableOpacity
                  style={styles.addSituationPillBtn}
                  onPress={() => handleAddLocationAsSituation(nearbyVenueFound)}
                >
                  <Text style={[styles.addSituationPillText, { fontSize: fs(13) }]}>
                    {currentLang === 'zh-TW' ? '＋ 加為場景' : '＋ Add'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dismissPillBtn}
                  onPress={() => setNearbyVenueFound(null)}
                >
                  <Text style={{ color: THEME.textMuted, fontSize: fs(16) }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.mainScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={styles.greetingSection}>
            <Text style={[styles.greetingTitle, { fontSize: fs(30) }]}>
              {currentLang === 'zh-TW' ? '準備好開始對話' : 'Ready to Communicate'}
            </Text>
            <Text style={[styles.greetingSub, { fontSize: fs(16) }]}>
              {currentLang === 'zh-TW'
                ? '選擇當前場景，快速雙向溝通：'
                : 'Select a situation for instant two-way dialog:'}
            </Text>
          </View>

          <View style={styles.heroCard}>
            <Image source={{ uri: getActiveCoverImage() }} style={styles.heroImageCentered} />
            <View style={styles.heroContent}>
              <Text style={[styles.heroTitle, { fontSize: fs(24) }]}>
                {activeVenue.name[currentLang] || activeVenue.name['zh-TW']}
              </Text>
              <TouchableOpacity
                style={styles.startModeBtn}
                onPress={() => {
                  resetStageToIdle();
                  setIsCounterMode(true);
                }}
              >
                <Text style={[styles.startModeBtnText, { fontSize: fs(17) }]}>
                  {currentLang === 'zh-TW' ? '開始櫃檯模式' : 'Start Counter Mode'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.heroHint, { fontSize: fs(13) }]}>
                {currentLang === 'zh-TW'
                  ? '手機平放在櫃檯上，上半部自動翻轉 180° 朝向店員。'
                  : 'Place flat on counter; top half flips 180° toward clerk.'}
              </Text>
            </View>
          </View>

          <View style={styles.carouselSection}>
            <Text style={[styles.carouselTitle, { fontSize: fs(17) }]}>
              {currentLang === 'zh-TW' ? '切換所有場景' : 'All Situations'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselScroll}
            >
              {venues.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.carouselItem}
                  onPress={() => setActiveVenue(v)}
                >
                  <Image
                    source={{ uri: customWallpapers[v.id] || v.coverImage }}
                    style={[
                      styles.carouselItemImg,
                      activeVenue.id === v.id && styles.carouselItemImgActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.carouselItemText,
                      { fontSize: fs(13) },
                      activeVenue.id === v.id && { color: THEME.orange, fontWeight: 'bold' },
                    ]}
                    numberOfLines={1}
                  >
                    {getVenueShortName(v)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Modal: Flexible Settings */}
        <Modal visible={isSettingsOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <ScrollView
              style={styles.settingsModalCardFull}
              contentContainerStyle={{ padding: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.settingsHeader}>
                <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
                  <Text style={{ color: THEME.text, fontSize: fs(26) }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.settingsModalTitle, { fontSize: fs(22) }]}>
                  {currentLang === 'zh-TW' ? '彈性顯示與字體設定' : 'Display & Font Settings'}
                </Text>
                <View style={{ width: 24 }} />
              </View>

              <Text style={[styles.settingsSectionTitle, { fontSize: fs(18) }]}>
                {currentLang === 'zh-TW'
                  ? '字體與按鈕大小 (全畫面即時縮放)'
                  : 'Font & UI Scale (Global)'}
              </Text>
              <Text style={[styles.settingHint, { fontSize: fs(14) }]}>
                {currentLang === 'zh-TW'
                  ? '依照您的視力與使用習慣自由調整，所有問題、建議按鈕與店員畫面皆會同步放大或縮小：'
                  : 'Adjust text and button sizes across all screens according to your preference:'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {FONT_SCALE_OPTIONS.map((f) => (
                  <TouchableOpacity
                    key={f.label}
                    style={[
                      styles.fontBtn,
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
                        { fontSize: fs(15) },
                        fontScale === f.val && { color: '#000', fontWeight: '800' },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Live Font Preview Box */}
              <View style={styles.fontPreviewBox}>
                <Text style={{ color: THEME.textMuted, fontSize: fs(13), marginBottom: 4 }}>
                  {currentLang === 'zh-TW' ? '字體大小預覽：' : 'Preview:'}
                </Text>
                <Text style={{ color: THEME.text, fontSize: fs(20), fontWeight: '700' }}>
                  {currentLang === 'zh-TW'
                    ? '發票要印嗎？ / 有載具嗎？'
                    : 'Print the receipt? / Carrier barcode?'}
                </Text>
              </View>

              <View style={styles.settingsDivider} />

              <Text style={[styles.settingsSectionTitle, { fontSize: fs(18) }]}>
                {currentLang === 'zh-TW' ? '翻譯設定' : 'Translation'}
              </Text>
              <View style={styles.settingRow}>
                <Text style={[styles.settingRowLabel, { fontSize: fs(16) }]}>
                  {currentLang === 'zh-TW' ? 'A/文 即時雙語翻譯' : 'A/文 Live Translate Mode'}
                </Text>
                <TouchableOpacity
                  style={[styles.toggleSwitch, isTranslateMode && styles.toggleSwitchActive]}
                  onPress={() => setIsTranslateMode(!isTranslateMode)}
                >
                  <View
                    style={[styles.toggleThumb, isTranslateMode && styles.toggleThumbActive]}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.settingsDivider} />

              <Text style={[styles.settingsSectionTitle, { fontSize: fs(18) }]}>
                {currentLang === 'zh-TW' ? '介面語言' : 'Interface Language'}
              </Text>
              {LANGUAGE_LIST.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOptionItem,
                    currentLang === lang.code && { backgroundColor: THEME.surfaceLight },
                  ]}
                  onPress={() => {
                    setCurrentLang(lang.code as SupportedLang);
                  }}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      { fontSize: fs(16) },
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

              <View style={styles.settingsDivider} />

              <Text style={[styles.settingsSectionTitle, { fontSize: fs(18) }]}>
                {currentLang === 'zh-TW' ? '自訂場景圖片 (Wallpaper)' : 'Custom Wallpaper URL'}
              </Text>
              <Text style={[styles.settingHint, { fontSize: fs(13) }]}>
                {currentLang === 'zh-TW'
                  ? `貼上圖片網址以更改「${activeVenue.name['zh-TW']}」的封面`
                  : `Paste image URL for ${activeVenue.name['en-US']}`}
              </Text>
              <TextInput
                style={[styles.inputField, { marginBottom: 8, fontSize: fs(15) }]}
                placeholder="https://..."
                placeholderTextColor={THEME.textMuted}
                value={wallpaperInputUrl}
                onChangeText={setWallpaperInputUrl}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={saveCustomWallpaper}>
                <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>
                  {currentLang === 'zh-TW' ? '儲存封面圖片' : 'Save Wallpaper'}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  // ============================================================================
  // 🔄 COUNTER SPLIT MODE (Top 180° Clerk Panel + Bottom User Control Panel)
  // ============================================================================
  const prioritizedCards = getPrioritizedCards();

  return (
    <View style={styles.screen}>
      {/* 🟠 TOP HALF: Clerk-Facing 180° Rotated Display */}
      <View style={[styles.splitTop, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.splitTopInner}>
          {/* Top Bar inside 180° Clerk View: Offline Clerk Pick Button (Green Box in Image 1) + Speaker */}
          <View style={styles.clerkTopActionRow}>
            <TouchableOpacity
              style={styles.clerkOfflinePickPill}
              onPress={() => {
                setClerkPickView('grid');
                setClerkDigits('');
                setIsClerkPickOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="店員點選問題 (Offline Clerk Pick)"
            >
              <Text style={[styles.clerkOfflinePickText, { fontSize: fs(16) }]}>
                📋 {currentLang === 'zh-TW' ? '或點這裡，選您要問的問題' : 'Tap here to pick a question'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clerkRoundSpeakBtn}
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
              <Text style={{ fontSize: fs(22) }}>🔊</Text>
            </TouchableOpacity>
          </View>

          {/* Main 180° Clerk Message Area */}
          <View style={styles.clerkMainMessageContainer}>
            {clerkMessage ? (
              <>
                {!!clerkLabel && (
                  <Text style={[styles.clerkStatusLabel, { fontSize: fs(17) }]}>
                    {clerkLabel}
                  </Text>
                )}
                <Text
                  style={[
                    styles.clerkMainMessageLarge,
                    {
                      fontSize: fs(clerkMessage.length <= 5 ? 54 : 38),
                      lineHeight: fs(clerkMessage.length <= 5 ? 62 : 46),
                    },
                  ]}
                  adjustsFontSizeToFit
                  numberOfLines={3}
                >
                  {clerkMessage}
                </Text>
                <Text style={[styles.clerkSecondaryMessage, { fontSize: fs(16) }]}>
                  {clerkSub ||
                    (currentLang === 'zh-TW'
                      ? '請直接對手機說話，或點上方按鈕選問題'
                      : 'Speak directly to phone or tap button above')}
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={[
                    styles.clerkDefaultHeadline,
                    { fontSize: fs(38), lineHeight: fs(46) },
                  ]}
                >
                  {currentLang === 'zh-TW' ? '我是聽障者' : 'I am D/HH'}
                </Text>
                <Text
                  style={[
                    styles.clerkDefaultHeadline,
                    { fontSize: fs(38), lineHeight: fs(46) },
                  ]}
                >
                  {currentLang === 'zh-TW' ? '請對著手機說話' : 'Please speak to phone'}
                </Text>
                <Text style={[styles.clerkDefaultSub, { fontSize: fs(18) }]}>
                  {currentLang === 'zh-TW'
                    ? '我會用螢幕回答您（太吵可點上方選問題）'
                    : 'I will answer via screen (or tap button above)'}
                </Text>
              </>
            )}
          </View>
        </View>
        <Text style={[styles.clerkFlipEdgeHint, { fontSize: fs(12) }]}>
          {currentLang === 'zh-TW' ? '這一面朝向店員' : 'This side faces the clerk'}
        </Text>
      </View>

      <View style={styles.splitDivider} />

      {/* ⚫ BOTTOM HALF: User-Facing Control Panel */}
      <View style={[styles.splitBottom, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.bottomHeaderGroup}>
          {/* Header Row: Venue Switcher, Offline Clerk Pick Trigger, Mic Listen Toggle, Font/Settings */}
          <View style={styles.bottomHeader}>
            <TouchableOpacity
              style={styles.venueDropdown}
              onPress={() => setIsCounterMode(false)}
            >
              <Text style={[styles.venueDropdownText, { fontSize: fs(15) }]}>
                {activeVenue.emoji} {getVenueShortName(activeVenue)} ▾
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {/* Offline Clerk Pick Trigger from User Side as well */}
              <TouchableOpacity
                style={styles.offlineModePill}
                onPress={() => {
                  setClerkPickView('grid');
                  setClerkDigits('');
                  setIsClerkPickOpen(true);
                }}
              >
                <Text style={[styles.offlineModePillText, { fontSize: fs(14) }]}>
                  📋 {currentLang === 'zh-TW' ? '店員點選' : 'Clerk Pick'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.liveStatusPill} onPress={toggleLiveListening}>
                <Text style={{ fontSize: fs(10) }}>{isLiveActive ? '🟢' : '⚪'}</Text>
                <Text style={[styles.liveStatusText, { fontSize: fs(14) }]}>
                  {isLiveActive
                    ? currentLang === 'zh-TW'
                      ? '正在聽'
                      : 'Listening'
                    : currentLang === 'zh-TW'
                    ? '點我開始聽'
                    : 'Tap to Listen'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smallSettingsBtn}
                onPress={() => setIsSettingsOpen(true)}
                accessibilityLabel="字體與設定"
              >
                <Text style={{ color: THEME.text, fontSize: fs(15), fontWeight: '700' }}>
                  Aa
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 💡 1-Tap Triggered Suggestion Pills + Speaker Button */}
          {smartReplies.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 8 }}
              contentContainerStyle={{ alignItems: 'center', gap: 8 }}
            >
              {smartReplies.map((reply: any) => (
                <View key={reply.id} style={styles.smartReplyPillWrap}>
                  <TouchableOpacity
                    style={styles.smartReplyMainTap}
                    onPress={() => {
                      if (reply.cardRef) openCardStage(reply.cardRef);
                      handleSelectOption(reply, reply.optRef);
                    }}
                  >
                    <Text style={[styles.smartReplyBtnText, { fontSize: fs(15) }]}>
                      💡 {reply.text}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smartReplySpeakerTap}
                    onPress={() => speakSentence(reply.clerkText || reply.text, 'zh-TW')}
                    accessibilityLabel="試聽這句話"
                  >
                    <Text style={{ fontSize: fs(15) }}>🔊</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* 🎙️ LIVE SUBTITLE TRANSCRIBE BOX + SPEAKER ICON (Yellow Box in Image 1) */}
          {liveStreamText ? (
            <View style={styles.liveSubtitleBox}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                {isTranslateMode && (
                  <Text
                    style={{
                      fontSize: fs(11),
                      color: THEME.translateAccent,
                      marginBottom: 2,
                    }}
                  >
                    A/文 Translated
                  </Text>
                )}
                <Text style={[styles.liveSubtitleText, { fontSize: fs(18) }]}>
                  "{liveStreamText}"
                </Text>
              </View>
              <TouchableOpacity
                style={styles.subtitleSpeakerBtn}
                onPress={() => speakSentence(liveStreamText)}
                accessibilityRole="button"
                accessibilityLabel="播放聽到的句子"
              >
                <Text style={{ fontSize: fs(20) }}>🔊</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* 📋 MAIN STAGE AREA: Shows Active Clerk Question Card (Image 2), Amount Confirmation, or Full Questions List */}
        <ScrollView
          style={styles.questionsList}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        >
          {/* CASE 1: Clerk entered an Amount on the 180° Keypad */}
          {pendingAmount !== null ? (
            <View style={styles.stageActiveCard}>
              <View style={styles.stageCardHeader}>
                <TouchableOpacity onPress={resetStageToIdle} style={styles.stageBackBtn}>
                  <Text style={[styles.stageBackText, { fontSize: fs(15) }]}>
                    ‹ {currentLang === 'zh-TW' ? '返回' : 'Back'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.stageCardCaption, { fontSize: fs(14) }]}>
                  {currentLang === 'zh-TW' ? '店員輸入的金額' : 'Clerk Entered Amount'}
                </Text>
                <TouchableOpacity
                  onPress={() => speakSentence(`${pendingAmount}元`, 'zh-TW')}
                  style={styles.stageSpeakSmallBtn}
                >
                  <Text style={{ fontSize: fs(18) }}>🔊</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.amountDisplayWell}>
                <Text style={[styles.amountCurrencyText, { fontSize: fs(20) }]}>NT$</Text>
                <Text style={[styles.amountFigureText, { fontSize: fs(48) }]}>
                  {pendingAmount.toLocaleString('zh-TW')}
                </Text>
                <Text style={[styles.amountCurrencyText, { fontSize: fs(20) }]}>元</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.amountConfirmBtn, { backgroundColor: THEME.text }]}
                  onPress={() => handleConfirmAmount(true)}
                >
                  <Text
                    style={{
                      color: THEME.bg,
                      fontSize: fs(18),
                      fontWeight: '800',
                    }}
                  >
                    ✓ {currentLang === 'zh-TW' ? '對，確認' : 'Confirm'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.amountConfirmBtn, { backgroundColor: THEME.danger }]}
                  onPress={() => handleConfirmAmount(false)}
                >
                  <Text
                    style={{
                      color: '#FFF',
                      fontSize: fs(18),
                      fontWeight: '800',
                    }}
                  >
                    ✕ {currentLang === 'zh-TW' ? '不對，重按' : 'Wrong'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : activePromptCard ? (
            /* CASE 2: Clerk Picked a Question or Voice Matched a Card (Matches Image 2 Red Box) */
            <View style={styles.stageActiveCard}>
              <View style={styles.stageCardHeader}>
                <TouchableOpacity onPress={resetStageToIdle} style={styles.stageBackBtn}>
                  <Text style={[styles.stageBackText, { fontSize: fs(15) }]}>
                    ‹ {currentLang === 'zh-TW' ? '返回' : 'Back'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.stageCardCaption, { fontSize: fs(14) }]}>
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
                  style={styles.stageSpeakSmallBtn}
                  accessibilityLabel="朗讀這個問題"
                >
                  <Text style={{ fontSize: fs(18) }}>🔊</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.stageQuestionHeadline, { fontSize: fs(28) }]}>
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
                      <TouchableOpacity
                        style={[
                          styles.stageOptionTile,
                          isSelected && styles.stageOptionTileSelected,
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
                            { fontSize: fs(20) },
                            isSelected && { color: '#000', fontWeight: '800' },
                          ]}
                        >
                          {optLabel}
                        </Text>
                        {opt.subLabels && (
                          <Text
                            style={[
                              styles.stageOptionTileSub,
                              { fontSize: fs(13) },
                              isSelected && { color: 'rgba(0,0,0,0.7)' },
                            ]}
                          >
                            {opt.subLabels[currentLang] || opt.subLabels['zh-TW']}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* All Prioritized Questions & Quick Answers List */}
          <Text style={[styles.sectionListHeader, { fontSize: fs(14) }]}>
            {currentLang === 'zh-TW'
              ? '點選問題或直接回答店員（點 🔊 可發音）：'
              : 'Tap a question or answer directly (Tap 🔊 to speak):'}
          </Text>

          {prioritizedCards.map((card) => {
            const qTitle = card.question?.[currentLang] || card.question?.['zh-TW'];
            return (
              <View key={card.id} style={styles.cardGroupBox}>
                {/* Question Header Row with Speaker & Open Card Stage */}
                {qTitle && (
                  <View style={styles.cardQuestionHeaderRow}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => openCardStage(card)}
                    >
                      <Text style={[styles.cardQuestionHeaderText, { fontSize: fs(16) }]}>
                        {qTitle}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rowSpeakerIconBtn}
                      onPress={() => speakSentence(qTitle, 'zh-TW')}
                      accessibilityLabel={`朗讀問題：${qTitle}`}
                    >
                      <Text style={{ fontSize: fs(16) }}>🔊</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Answer Options inside the Card */}
                {card.options.map((opt: any, idx: number) => {
                  const mainLabel = opt.labels[currentLang] || opt.labels['zh-TW'];
                  const subLabel = opt.subLabels?.[currentLang] || opt.subLabels?.['zh-TW'];
                  return (
                    <View key={`${card.id}_${idx}`} style={styles.questionRow}>
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
                        <Text style={[styles.questionTitle, { fontSize: fs(19) }]}>
                          {mainLabel}
                        </Text>
                        {subLabel && (
                          <Text style={[styles.questionSub, { fontSize: fs(14) }]}>
                            {subLabel}
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rowSpeakerIconBtn}
                        onPress={() => speakSentence(opt.tts || opt.labels['zh-TW'], 'zh-TW')}
                        accessibilityLabel={`發音：${mainLabel}`}
                      >
                        <Text style={{ fontSize: fs(18) }}>🔊</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.questionRow, { paddingHorizontal: 12, marginTop: 8 }]}
            onPress={() => setIsSOSOpen(true)}
          >
            <View style={styles.questionTextCol}>
              <Text
                style={[
                  styles.questionTitle,
                  { color: THEME.danger, fontSize: fs(19) },
                ]}
              >
                🚨 {currentLang === 'zh-TW' ? '緊急醫療求助 (SOS)' : 'Medical SOS'}
              </Text>
              <Text style={[styles.questionSub, { fontSize: fs(14) }]}>
                {currentLang === 'zh-TW' ? '顯示緊急醫療卡並播放求助語音' : 'Show emergency card & speak'}
              </Text>
            </View>
            <Text style={[styles.questionArrow, { fontSize: fs(24) }]}>›</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.bottomActionBar}>
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={() => {
              const askAgain =
                currentLang === 'zh-TW'
                  ? '不好意思，我沒聽清楚，可以再說一次或用點的嗎？'
                  : 'Sorry, could you say that again or tap the screen?';
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
            <Text style={[styles.actionBtnSecondaryText, { fontSize: fs(16) }]}>
              ❓ {currentLang === 'zh-TW' ? '我沒聽懂 / 再說一次' : 'Say Again'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => setIsTypeToClerkOpen(true)}
          >
            <Text style={[styles.actionBtnPrimaryText, { fontSize: fs(16) }]}>
              ✏️ {currentLang === 'zh-TW' ? '打字' : 'Type'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ============================================================================ */}
      {/* 🔄 MODAL: 180° ROTATED OFFLINE CLERK PICK & AMOUNT KEYPAD (Matches Image 3) */}
      {/* ============================================================================ */}
      <Modal
        visible={isClerkPickOpen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setIsClerkPickOpen(false)}
      >
        <View style={styles.clerkPickModalRoot}>
          {/* Top Part: Rotated 180° so the Clerk standing across the counter reads it upright */}
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
                {/* Orange Outlined "輸入金額" Tile (First tile in Grid, matching Image 3) */}
                <View style={styles.clerkPickCell}>
                  <TouchableOpacity
                    style={[styles.clerkPickTile, styles.clerkPickAmountTile]}
                    onPress={() => setClerkPickView('amount')}
                  >
                    <Text style={{ fontSize: fs(24), color: THEME.orange }}>🔢</Text>
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

                {/* All Situation & Checkout Questions for the Clerk to Tap */}
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
              /* 180° Custom Numeric Keypad for Clerk to Enter Price */
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
                    <Text style={{ color: THEME.text, fontSize: fs(18), fontWeight: '600' }}>
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

          {/* Bottom Bar (Upright for the User): Cancel & Return */}
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
          <View style={styles.typeModalCard}>
            <Text style={[styles.settingsModalTitle, { fontSize: fs(20), marginBottom: 12 }]}>
              ✏️ {currentLang === 'zh-TW' ? '打字給對方看' : 'Type to Clerk'}
              {isTranslateMode && currentLang === 'en-US' && (
                <Text style={{ color: THEME.translateAccent, fontSize: fs(13) }}>
                  {' '}
                  (Auto-Translate)
                </Text>
              )}
            </Text>
            <TextInput
              style={[styles.inputField, { fontSize: fs(17), minHeight: 80 }]}
              placeholder={currentLang === 'zh-TW' ? '輸入文字或電話號碼...' : 'Type text...'}
              placeholderTextColor={THEME.textMuted}
              value={customTypeInput}
              onChangeText={setCustomTypeInput}
              multiline
              autoFocus
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleTypeToClerkSubmit}>
              <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>
                🔊 {currentLang === 'zh-TW' ? '顯示並發音' : 'Show & Speak'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.closeBtn, { marginTop: 8 }]}
              onPress={() => setIsTypeToClerkOpen(false)}
            >
              <Text style={[styles.closeBtnText, { fontSize: fs(15) }]}>
                {currentLang === 'zh-TW' ? '關閉 (Close)' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Settings (Accessible directly from Counter Mode via "Aa" button) */}
      <Modal visible={isSettingsOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.typeModalCard}>
            <Text style={[styles.settingsModalTitle, { fontSize: fs(20), marginBottom: 12 }]}>
              {currentLang === 'zh-TW' ? '字體大小調整' : 'Adjust Font Size'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {FONT_SCALE_OPTIONS.map((f) => (
                <TouchableOpacity
                  key={f.label}
                  style={[
                    styles.fontBtn,
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
                      { fontSize: fs(14) },
                      fontScale === f.val && { color: '#000', fontWeight: '800' },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => setIsSettingsOpen(false)}
            >
              <Text style={[styles.sendBtnText, { fontSize: fs(16) }]}>
                {currentLang === 'zh-TW' ? '完成' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: SOS Emergency */}
      <Modal visible={isSOSOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={{ width: '90%', maxWidth: 460 }}>
            <View style={styles.sosCardFull}>
              <View style={styles.sosCardHeader}>
                <Text style={{ fontSize: fs(24) }}>🚨</Text>
                <Text style={[styles.sosTitle, { fontSize: fs(22) }]}>
                  {currentLang === 'zh-TW' ? '緊急醫療求助' : 'Medical SOS'}
                </Text>
              </View>
              <View style={styles.sosInfoBox}>
                <View style={styles.sosInfoRow}>
                  <Text style={[styles.sosTextKey, { fontSize: fs(15) }]}>Name:</Text>
                  <Text style={[styles.sosTextValue, { fontSize: fs(15) }]}>
                    Udhayaraj (Raj)
                  </Text>
                </View>
                <View style={styles.sosInfoRow}>
                  <Text style={[styles.sosTextKey, { fontSize: fs(15) }]}>Blood:</Text>
                  <Text style={[styles.sosTextValue, { fontSize: fs(15) }]}>O+</Text>
                </View>
                <Text style={[styles.sosQuote, { fontSize: fs(15) }]}>
                  "I am having a medical emergency. Please read my screen."
                </Text>
              </View>
              <TouchableOpacity
                style={styles.sosSpeakBtn}
                onPress={() =>
                  speakSentence('我現在有緊急醫療狀況，請幫助我。', 'zh-TW')
                }
              >
                <Text style={[styles.sosSpeakBtnText, { fontSize: fs(17) }]}>
                  🔊 播放求助語音
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sosCloseBtn}
                onPress={() => setIsSOSOpen(false)}
              >
                <Text style={[styles.sosCloseBtnText, { fontSize: fs(15) }]}>
                  關閉 (Close)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 10,
    paddingHorizontal: 16,
  },
  homeTitleLogo: {
    fontWeight: '800',
    color: THEME.text,
    fontFamily: THEME.fontFamily,
  },
  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: THEME.text, fontWeight: '700' },
  satelliteDropdownContainer: { paddingHorizontal: 16, marginBottom: 12, zIndex: 100 },
  satelliteResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.success,
  },
  satelliteFoundLabel: { color: THEME.textMuted, fontWeight: '600' },
  satelliteFoundName: { color: THEME.text, fontWeight: '700', marginTop: 2 },
  nearbyPulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.success },
  addSituationPillBtn: {
    backgroundColor: THEME.orange,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addSituationPillText: { color: '#000', fontWeight: '800' },
  dismissPillBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  mainScroll: { flex: 1 },
  greetingSection: { marginBottom: 18, marginTop: 8, paddingHorizontal: 16 },
  greetingTitle: {
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 4,
    fontFamily: THEME.fontFamily,
  },
  greetingSub: {
    fontWeight: '500',
    color: THEME.textMuted,
    fontFamily: THEME.fontFamily,
  },
  heroCard: {
    backgroundColor: THEME.surface,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  heroImageCentered: { width: '100%', height: 185, resizeMode: 'cover' },
  heroContent: { padding: 20, width: '100%' },
  heroTitle: {
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 14,
    fontFamily: THEME.fontFamily,
  },
  startModeBtn: {
    backgroundColor: THEME.orange,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  startModeBtnText: {
    color: '#000',
    fontWeight: '800',
    fontFamily: THEME.fontFamily,
  },
  heroHint: {
    color: THEME.textMuted,
    textAlign: 'center',
    fontFamily: THEME.fontFamily,
  },
  carouselSection: { paddingLeft: 16 },
  carouselTitle: {
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 14,
    fontFamily: THEME.fontFamily,
  },
  carouselScroll: { gap: 14, paddingBottom: 20, paddingRight: 16 },
  carouselItem: { alignItems: 'center', width: 84 },
  carouselItemImg: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  carouselItemImgActive: { borderColor: THEME.orange },
  carouselItemText: {
    color: THEME.textMuted,
    fontWeight: '500',
    fontFamily: THEME.fontFamily,
    textAlign: 'center',
  },

  // 🟠 TOP 180° CLERK SPLIT PANEL
  splitTop: {
    flex: 0.92,
    backgroundColor: THEME.orange,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitTopInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    transform: [{ rotate: '180deg' }],
  },
  clerkTopActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  clerkOfflinePickPill: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkOfflinePickText: {
    color: THEME.orange,
    fontWeight: '800',
    fontFamily: THEME.fontFamily,
  },
  clerkRoundSpeakBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkMainMessageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  clerkStatusLabel: {
    color: 'rgba(0,0,0,0.75)',
    fontWeight: '800',
    marginBottom: 6,
  },
  clerkDefaultHeadline: {
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    letterSpacing: -0.5,
    fontFamily: THEME.fontFamily,
  },
  clerkDefaultSub: {
    fontWeight: '700',
    color: 'rgba(0,0,0,0.75)',
    marginTop: 12,
    textAlign: 'center',
    fontFamily: THEME.fontFamily,
  },
  clerkMainMessageLarge: {
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    fontFamily: THEME.fontFamily,
  },
  clerkSecondaryMessage: {
    fontWeight: '700',
    color: 'rgba(0,0,0,0.7)',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: THEME.fontFamily,
  },
  clerkFlipEdgeHint: {
    color: 'rgba(0,0,0,0.65)',
    fontWeight: '700',
    paddingBottom: 4,
  },
  splitDivider: { height: 3, backgroundColor: '#222' },

  // ⚫ BOTTOM USER SPLIT PANEL
  splitBottom: {
    flex: 1.25,
    backgroundColor: THEME.bg,
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
    backgroundColor: THEME.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  venueDropdownText: {
    color: THEME.text,
    fontWeight: '700',
    fontFamily: THEME.fontFamily,
  },
  offlineModePill: {
    backgroundColor: THEME.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.orange,
  },
  offlineModePillText: {
    color: THEME.orange,
    fontWeight: '700',
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 6,
  },
  liveStatusText: {
    color: THEME.text,
    fontWeight: '700',
    fontFamily: THEME.fontFamily,
  },
  smallSettingsBtn: {
    backgroundColor: THEME.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },

  // 💡 SMART REPLY PILLS WITH SPEAKER
  smartReplyPillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: THEME.orange,
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
    backgroundColor: THEME.surfaceLight,
    borderLeftWidth: 1,
    borderLeftColor: THEME.border,
  },
  smartReplyBtnText: { color: THEME.text, fontWeight: '700' },

  // 🎙️ LIVE SUBTITLE BOX WITH SPEAKER BUTTON (Yellow Box in Image 1)
  liveSubtitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: THEME.success,
  },
  liveSubtitleText: {
    color: THEME.success,
    fontWeight: '700',
    fontFamily: THEME.fontFamily,
  },
  subtitleSpeakerBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 🎯 INTERACTIVE STAGE CARD (Matches Image 2 Red Box)
  stageActiveCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: THEME.orange,
    padding: 14,
    marginBottom: 14,
  },
  stageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stageBackBtn: {
    paddingVertical: 4,
    paddingRight: 10,
  },
  stageBackText: {
    color: THEME.textMuted,
    fontWeight: '600',
  },
  stageCardCaption: {
    color: THEME.textMuted,
    fontWeight: '600',
  },
  stageSpeakSmallBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: THEME.surfaceLight,
  },
  stageQuestionHeadline: {
    color: THEME.text,
    fontWeight: '800',
    marginBottom: 14,
  },
  stageOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  stageOptionCell: {
    padding: 4,
  },
  stageOptionTile: {
    minHeight: 68,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageOptionTileSelected: {
    backgroundColor: THEME.orange,
    borderColor: THEME.orange,
  },
  stageOptionTileText: {
    color: THEME.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  stageOptionTileSub: {
    color: THEME.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  amountDisplayWell: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.bg,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  amountCurrencyText: { color: THEME.textMuted, fontWeight: '600' },
  amountFigureText: { color: THEME.text, fontWeight: '900' },
  amountConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 📋 QUESTIONS LIST
  questionsList: { flex: 1 },
  sectionListHeader: {
    color: THEME.textMuted,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  cardGroupBox: {
    backgroundColor: THEME.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardQuestionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  cardQuestionHeaderText: {
    color: THEME.orange,
    fontWeight: '800',
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  questionTextCol: { flex: 1, gap: 2, paddingRight: 8 },
  questionTitle: {
    fontWeight: '700',
    color: THEME.text,
    fontFamily: THEME.fontFamily,
  },
  questionSub: { color: THEME.textMuted, fontFamily: THEME.fontFamily },
  rowSpeakerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionArrow: { color: THEME.textMuted },

  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: THEME.bg,
  },
  actionBtnSecondary: {
    flex: 1.5,
    backgroundColor: THEME.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  actionBtnSecondaryText: {
    color: THEME.text,
    fontWeight: '700',
    fontFamily: THEME.fontFamily,
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: THEME.surfaceLight,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnPrimaryText: {
    color: THEME.text,
    fontWeight: '700',
    fontFamily: THEME.fontFamily,
  },

  // 🔄 180° CLERK PICK MODAL STYLES (Matches Image 3)
  clerkPickModalRoot: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  clerkPickRotatedArea: {
    flex: 1,
    transform: [{ rotate: '180deg' }],
    paddingHorizontal: 16,
  },
  clerkPickHeader: {
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  clerkPickOrangeSub: {
    color: THEME.orange,
    fontWeight: '700',
    marginBottom: 4,
  },
  clerkPickMainTitle: {
    color: THEME.text,
    fontWeight: '900',
  },
  clerkPickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    paddingBottom: 24,
  },
  clerkPickCell: {
    width: '50%',
    padding: 6,
  },
  clerkPickTile: {
    height: 100,
    backgroundColor: THEME.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  clerkPickAmountTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderColor: THEME.orange,
    borderWidth: 1.5,
  },
  clerkPickTileText: {
    color: THEME.text,
    fontWeight: '700',
  },
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
    backgroundColor: THEME.surface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  clerkKeypadCurrency: { color: THEME.textMuted, fontWeight: '600' },
  clerkKeypadFigure: { color: THEME.text, fontWeight: '900' },
  clerkKeypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  clerkKeyCell: {
    width: '33.333%',
    padding: 4,
  },
  clerkKeyBtn: {
    minHeight: 58,
    backgroundColor: THEME.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkKeyBtnText: {
    color: THEME.text,
    fontWeight: '700',
  },
  clerkKeypadGhostBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkKeypadSubmitBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: THEME.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clerkPickUserCancelBar: {
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    paddingTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.bg,
  },
  clerkPickUserCancelText: {
    color: THEME.textMuted,
    fontWeight: '700',
  },

  // MODALS & SETTINGS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsModalCardFull: {
    width: '100%',
    height: '100%',
    backgroundColor: THEME.bg,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  settingsModalTitle: {
    fontWeight: '800',
    color: THEME.text,
    fontFamily: THEME.fontFamily,
  },
  settingsSectionTitle: {
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 8,
    marginTop: 12,
  },
  fontBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.surface,
    alignItems: 'center',
  },
  fontBtnText: { color: THEME.text, fontWeight: '600' },
  fontPreviewBox: {
    backgroundColor: THEME.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  typeModalCard: {
    width: '90%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  langOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: THEME.surface,
  },
  langOptionText: { color: THEME.text, fontFamily: THEME.fontFamily },
  settingsDivider: { height: 1, backgroundColor: THEME.border, marginVertical: 20 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingRowLabel: { color: THEME.text, fontWeight: '500' },
  toggleSwitch: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    justifyContent: 'center',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: THEME.translateAccent,
    borderColor: THEME.translateAccent,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.textMuted,
  },
  toggleThumbActive: {
    backgroundColor: '#FFF',
    transform: [{ translateX: 22 }],
  },
  settingHint: { color: THEME.textMuted, lineHeight: 20, marginBottom: 12 },
  closeBtn: { paddingVertical: 12, alignItems: 'center' },
  closeBtnText: {
    fontWeight: '600',
    color: THEME.textMuted,
    fontFamily: THEME.fontFamily,
  },
  inputField: {
    width: '100%',
    minHeight: 56,
    borderRadius: 10,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
    color: THEME.text,
    marginBottom: 12,
  },
  sendBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: THEME.orange,
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#000',
    fontWeight: '800',
    fontFamily: THEME.fontFamily,
  },
  sosCardFull: { backgroundColor: '#FF3B30', borderRadius: 20, padding: 24 },
  sosCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sosTitle: { color: '#FFF', fontWeight: '800', fontFamily: THEME.fontFamily },
  sosInfoBox: {
    backgroundColor: '#CC2E26',
    borderRadius: 12,
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
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  sosSpeakBtnText: { color: '#FF3B30', fontWeight: '800' },
  sosCloseBtn: { paddingVertical: 12, alignItems: 'center' },
  sosCloseBtnText: { color: '#FFF', fontWeight: '600' },
});

export default CounterConversationScreen;