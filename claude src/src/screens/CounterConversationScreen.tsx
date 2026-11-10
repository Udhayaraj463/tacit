// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Modal, 
  ActivityIndicator, 
  Image, 
  TextInput,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Video, ResizeMode } from 'expo-av';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  fontFamily: Platform.OS === 'web' ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : undefined,
};

export type SupportedLang = 'en-US' | 'zh-TW';

const LOCAL_BOT_ASSETS = {
  floating: Platform.OS === 'web' ? 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif' : require('../../../bot/gif/Floating.mp4'),
  listen: Platform.OS === 'web' ? 'https://media.giphy.com/media/3o7bu3XilJ5BOiSGic/giphy.gif' : require('../../../bot/gif/Listen.mp4'),
  hospital: Platform.OS === 'web' ? 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif' : require('../../../bot/gif/Hospital.mp4'),
  sevenEleven: Platform.OS === 'web' ? 'https://media.giphy.com/media/3o7bu3XilJ5BOiSGic/giphy.gif' : require('../../../bot/gif/7 Eleven.mp4'),
  cafe: Platform.OS === 'web' ? 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif' : require('../../../bot/gif/Cafe.mp4'),
  restaurant: Platform.OS === 'web' ? 'https://media.giphy.com/media/3o7bu3XilJ5BOiSGic/giphy.gif' : require('../../../bot/gif/Restaurant.mp4'),
  hello: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif',
  bye: 'https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif',
};

// 🎥 CRITICAL FIX: Cross-platform Video Player (HTML5 for Web, expo-av for iOS/Android)
const MochiMediaPlayer: React.FC<{ source: any; style?: any }> = ({ source, style }) => {
  if (Platform.OS === 'web') {
    let uri = '';
    if (typeof source === 'string') uri = source;
    else if (typeof source === 'number') {
      try { uri = Image.resolveAssetSource(source)?.uri || ''; } catch (e) {}
    } else if (source && typeof source === 'object' && source.uri) {
      uri = source.uri;
    }
    
    if (uri.includes('.mp4')) {
      return (
        <video 
          key={uri}
          src={uri} 
          autoPlay loop muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} 
        />
      );
    }
    return <Image key={uri} source={{ uri }} style={[{ width: '100%', height: '100%', resizeMode: 'cover' }, style]} />;
  }

  // NATIVE IOS & ANDROID
  return (
    <Video
      source={source}
      style={[{ width: '100%', height: '100%' }, style]}
      resizeMode={ResizeMode.COVER}
      shouldPlay
      isLooping
      isMuted
    />
  );
};

const realTranslate = async (text: string, fromLang: string, toLang: string) => {
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`);
    const data = await res.json();
    return data.responseData.translatedText;
  } catch (error) { return `[Translation Error] ${text}`; }
};

const fetchGeminiResponse = async (userText: string) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return "API Key missing. Please check your .env file.";
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: "You are Mochi, a helpful AI assistant in Taiwan. Keep responses extremely concise (1-2 sentences). Respond to the next prompt naturally." }] },
          { role: "user", parts: [{ text: userText }] }
        ]
      })
    });
    const data = await res.json();
    if (data.error) return `API Error: ${data.error.message}`;
    if (data.candidates && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    return "I couldn't generate a response.";
  } catch (e) {
    return "Connection error with Gemini.";
  }
};

export const LANGUAGE_LIST = [
  { code: 'zh-TW', name: '繁體中文 (Traditional Chinese)', short: '中文' },
  { code: 'en-US', name: 'English (US)', short: 'English' }
];

const STORES_DATA = [
  { id: "cvs", name: { "zh-TW": "便利商店", "en-US": "Convenience Store" }, short: "7 Eleven", emoji: "🏪", coverImage: "https://images.unsplash.com/photo-1601599561096-f87c95fff1e9?w=1200", mochi: LOCAL_BOT_ASSETS.sevenEleven },
  { id: "drink", name: { "zh-TW": "飲料店", "en-US": "Drink Shop" }, short: "Cafe", emoji: "🧋", coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200", mochi: LOCAL_BOT_ASSETS.cafe },
  { id: "breakfast", name: { "zh-TW": "早餐店", "en-US": "Breakfast Shop" }, short: "Breakfast", emoji: "🥪", coverImage: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1200", mochi: LOCAL_BOT_ASSETS.restaurant },
  { id: "pharmacy", name: { "zh-TW": "藥局", "en-US": "Pharmacy" }, short: "Pharmacy", emoji: "💊", coverImage: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200", mochi: LOCAL_BOT_ASSETS.hospital },
  { id: "market", name: { "zh-TW": "市場", "en-US": "Traditional Market" }, short: "Market", emoji: "🥬", coverImage: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=1200", mochi: LOCAL_BOT_ASSETS.restaurant },
  { id: "buffet", name: { "zh-TW": "自助餐・便當", "en-US": "Bento & Buffet" }, short: "Buffet", emoji: "🍱", coverImage: "https://images.unsplash.com/photo-1548943487-a2e4b43b5930?w=1200", mochi: LOCAL_BOT_ASSETS.restaurant },
  { id: "salon", name: { "zh-TW": "美髮店", "en-US": "Hair Salon" }, short: "Salon", emoji: "✂️", coverImage: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200", mochi: LOCAL_BOT_ASSETS.floating },
  { id: "other", name: { "zh-TW": "任何店家", "en-US": "General Store" }, short: "Other", emoji: "🏬", coverImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200", mochi: LOCAL_BOT_ASSETS.floating }
];

const CARDS_DATA = [
  { id: "greet", stores: ["*"], keywords: ["how are you", "hello", "hi", "what do you want", "how can i help", "你好", "早安", "午安", "怎麼了", "需要什麼"], options: [{ labels: { "zh-TW": "你好", "en-US": "Hello" }, subLabels: { "zh-TW": "打招呼", "en-US": "General greeting" }, tts: "你好" }, { labels: { "zh-TW": "我需要幫忙", "en-US": "I need help" }, subLabels: { "zh-TW": "請求協助", "en-US": "Ask for assistance" }, tts: "你好，我需要一些幫忙。" }] },
  { id: "dinein", stores: ["*"], keywords: ["內用", "外帶", "帶走", "這裡吃", "在這吃", "here", "to go", "dine in", "takeout"], options: [{ labels: { "zh-TW": "內用", "en-US": "Dine In" }, subLabels: { "zh-TW": "在這裡吃", "en-US": "Eat here" }, tts: "內用，謝謝" }, { labels: { "zh-TW": "外帶", "en-US": "Takeout" }, subLabels: { "zh-TW": "帶走", "en-US": "To go" }, tts: "外帶，謝謝" }] },
  { id: "carrier", stores: ["*"], keywords: ["載具", "條碼", "雲端發票", "發票", "receipt", "barcode"], options: [{ labels: { "zh-TW": "手機條碼", "en-US": "Scan Phone Barcode" }, subLabels: { "zh-TW": "存入載具", "en-US": "Save to carrier" }, tts: "有，我給你掃手機條碼" }, { labels: { "zh-TW": "不用", "en-US": "No Receipt Needed" }, subLabels: { "zh-TW": "不印發票", "en-US": "No paper receipt" }, tts: "不用，謝謝" }] },
  { id: "pay", stores: ["*"], keywords: ["現金", "刷卡", "付款", "支付", "pay", "悠遊卡", "cash", "credit card"], options: [{ labels: { "zh-TW": "現金", "en-US": "Cash" }, subLabels: { "zh-TW": "付現", "en-US": "Pay in cash" }, tts: "現金付款" }, { labels: { "zh-TW": "刷卡", "en-US": "Card / Apple Pay" }, subLabels: { "zh-TW": "信用卡或感應", "en-US": "Credit or NFC" }, tts: "刷卡" }] },
  { id: "bag", stores: ["*"], keywords: ["袋子", "提袋", "購物袋", "塑膠袋", "bag"], options: [{ labels: { "zh-TW": "要袋子", "en-US": "Need Bag" }, subLabels: { "zh-TW": "買一個提袋", "en-US": "Buy a shopping bag" }, tts: "要，謝謝" }, { labels: { "zh-TW": "不用", "en-US": "No Bag" }, subLabels: { "zh-TW": "我自己有帶", "en-US": "I have my own" }, tts: "不用，謝謝" }] },
  { id: "heat", stores: ["cvs"], keywords: ["加熱", "微波", "熱一下", "要熱嗎", "heat", "microwave", "warm"], options: [{ labels: { "zh-TW": "要微波", "en-US": "Heat up" }, subLabels: { "zh-TW": "幫我加熱", "en-US": "Microwave please" }, tts: "要，謝謝" }, { labels: { "zh-TW": "不用", "en-US": "No need" }, subLabels: { "zh-TW": "維持原樣", "en-US": "Keep it as is" }, tts: "不用，謝謝" }] },
  { id: "icelevel", stores: ["drink"], keywords: ["冰塊", "正常冰", "少冰", "微冰", "去冰", "冰量", "冰的", "熱的", "ice", "hot", "cold"], options: [{ labels: { "zh-TW": "少冰", "en-US": "Less Ice" }, subLabels: { "zh-TW": "減少冰塊", "en-US": "Reduce ice" }, tts: "少冰" }, { labels: { "zh-TW": "去冰", "en-US": "No Ice" }, subLabels: { "zh-TW": "完全不要冰塊", "en-US": "Zero ice" }, tts: "去冰" }] },
  { id: "sugar", stores: ["drink"], keywords: ["糖", "甜", "sugar", "sweet"], options: [{ labels: { "zh-TW": "微糖", "en-US": "Light Sugar" }, subLabels: { "zh-TW": "30% 糖", "en-US": "30% sweetness" }, tts: "微糖" }, { labels: { "zh-TW": "無糖", "en-US": "No Sugar" }, subLabels: { "zh-TW": "0% 糖", "en-US": "0% sweetness" }, tts: "無糖" }] },
  { id: "egg", stores: ["breakfast"], keywords: ["加蛋", "加個蛋", "要蛋", "egg"], options: [{ labels: { "zh-TW": "要加蛋", "en-US": "Add Egg" }, subLabels: { "zh-TW": "加一顆荷包蛋", "en-US": "Add a fried egg" }, tts: "要加蛋" }, { labels: { "zh-TW": "不用", "en-US": "No Egg" }, subLabels: { "zh-TW": "維持原樣", "en-US": "Keep as is" }, tts: "不用，謝謝" }] },
  { id: "allergy", stores: ["pharmacy"], keywords: ["過敏", "allergy", "allergies"], options: [{ labels: { "zh-TW": "沒有過敏", "en-US": "No Allergies" }, subLabels: { "zh-TW": "沒有藥物過敏", "en-US": "No drug allergies" }, tts: "沒有過敏" }, { labels: { "zh-TW": "有過敏", "en-US": "Have Allergies" }, subLabels: { "zh-TW": "我對某些藥物過敏", "en-US": "Allergic to some meds" }, tts: "我有藥物過敏" }] },
  { id: "rice", stores: ["buffet"], keywords: ["白飯", "飯要", "飯量", "半碗", "飯多少", "飯少", "rice"], options: [{ labels: { "zh-TW": "正常", "en-US": "Normal Rice" }, subLabels: { "zh-TW": "正常份量", "en-US": "Standard portion" }, tts: "飯正常" }, { labels: { "zh-TW": "少一點", "en-US": "Less Rice" }, subLabels: { "zh-TW": "飯量減半", "en-US": "Half portion" }, tts: "飯少一點" }, { labels: { "zh-TW": "不要飯", "en-US": "No Rice" }, subLabels: { "zh-TW": "只要菜", "en-US": "Only side dishes" }, tts: "不要飯" }] },
  { id: "length", stores: ["salon"], keywords: ["剪多短", "多短", "剪多少", "長度", "剪短", "修一下", "short", "trim", "length"], options: [{ labels: { "zh-TW": "修一點就好", "en-US": "Just a trim" }, subLabels: { "zh-TW": "維持現有長度", "en-US": "Keep current length" }, tts: "修一點就好" }, { labels: { "zh-TW": "照照片剪", "en-US": "Follow photo" }, subLabels: { "zh-TW": "給您看參考圖", "en-US": "Show reference picture" }, tts: "照我給您看的照片剪" }] }
];

export const CounterConversationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  
  const [currentLang, setCurrentLang] = useState<SupportedLang>('zh-TW');
  const [isTranslateMode, setIsTranslateMode] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [isCounterMode, setIsCounterMode] = useState(false);
  
  const [venues] = useState(STORES_DATA);
  const [activeVenue, setActiveVenue] = useState(STORES_DATA[0]);
  const [customWallpapers, setCustomWallpapers] = useState<Record<string, string>>({});
  const [wallpaperInputUrl, setWallpaperInputUrl] = useState('');
  
  const [clerkMessage, setClerkMessage] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSOSOpen, setIsSOSOpen] = useState(false);

  const [isMochiChatOpen, setIsMochiChatOpen] = useState(false);
  const [isTypeToClerkOpen, setIsTypeToClerkOpen] = useState(false);

  const [mochiInputText, setMochiInputText] = useState('');
  const [isMochiTyping, setIsMochiTyping] = useState(false);
  const [mochiChat, setMochiChat] = useState<{role: string, text: string}[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [nearbyVenueFound, setNearbyVenueFound] = useState<any>(null);
  
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStreamText, setLiveStreamText] = useState('');
  const [smartReplies, setSmartReplies] = useState<any[]>([]);

  const [roamPos, setRoamPos] = useState({ x: 260, y: 140 });
  const roamRef = useRef({ x: 260, y: 140, vx: -0.6, vy: -0.5 });
  const containerSizeRef = useRef({ width: 440, height: 760 });

  // 💾 Native Storage for Wallpapers
  useEffect(() => {
    const loadWallpapers = async () => {
      try {
        if (Platform.OS === 'web') {
          const saved = localStorage.getItem('tacit_wallpapers');
          if (saved) setCustomWallpapers(JSON.parse(saved));
        } else {
          const saved = await AsyncStorage.getItem('tacit_wallpapers');
          if (saved) setCustomWallpapers(JSON.parse(saved));
        }
      } catch (e) {}
    };
    loadWallpapers();
  }, []);

  const saveCustomWallpaper = async () => {
    if (!wallpaperInputUrl.trim()) return;
    const newUrl = wallpaperInputUrl.trim();
    const newWallpapers = { ...customWallpapers, [activeVenue.id]: newUrl };
    
    setCustomWallpapers(newWallpapers);
    
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('tacit_wallpapers', JSON.stringify(newWallpapers));
      } else {
        await AsyncStorage.setItem('tacit_wallpapers', JSON.stringify(newWallpapers));
      }
    } catch(e){}
    setWallpaperInputUrl('');
  };

  const getActiveCoverImage = () => customWallpapers[activeVenue.id] || activeVenue.coverImage;

  useEffect(() => {
    let animId: number;
    const runPhysics = () => {
      const r = roamRef.current;
      if (!isMochiChatOpen && !isCounterMode) {
        r.x += r.vx;
        r.y += r.vy;
        const maxX = Math.max(80, containerSizeRef.current.width - 100);
        const maxY = Math.max(120, containerSizeRef.current.height - 90);
        if (r.x <= 14) { r.x = 14; r.vx = Math.abs(r.vx); }
        else if (r.x >= maxX) { r.x = maxX; r.vx = -Math.abs(r.vx); }
        if (r.y <= 20) { r.y = 20; r.vy = Math.abs(r.vy); }
        else if (r.y >= maxY) { r.y = maxY; r.vy = -Math.abs(r.vy); }
        setRoamPos({ x: r.x, y: r.y });
      }
      animId = requestAnimationFrame(runPhysics);
    };
    animId = requestAnimationFrame(runPhysics);
    return () => cancelAnimationFrame(animId);
  }, [isMochiChatOpen, isCounterMode]);

  const recognitionRef = useRef<any>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) return; // Silent guard on iOS/Android to prevent crashes
      
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = isTranslateMode ? (currentLang === 'en-US' ? 'zh-TW' : 'en-US') : currentLang;

      rec.onresult = async (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          interim += event.results[i][0].transcript;
        }
        
        const rawText = interim.trim();
        if (rawText) {
          let translated = '';
          
          if (isTranslateMode) {
             setLiveStreamText(`...`);
             if (event.results[event.results.length - 1].isFinal) {
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
          const validCards = CARDS_DATA.filter(c => c.stores.includes('*') || c.stores.includes(activeVenue.id));
          const triggeredReplies: any[] = [];
          
          validCards.forEach(card => {
            if (card.keywords.some(kw => lowerRaw.includes(kw.toLowerCase()) || (translated && lowerTrans.includes(kw.toLowerCase())))) {
              card.options.forEach((opt, idx) => {
                triggeredReplies.push({
                  id: `${card.id}_${idx}`,
                  text: opt.labels[currentLang] || opt.labels['zh-TW'],
                  clerkText: opt.tts || opt.labels['zh-TW']
                });
              });
            }
          });
          setSmartReplies(triggeredReplies);
        }
      };
      recognitionRef.current = rec;
      if (isLiveActive) { try { rec.start(); } catch (e) {} }
    }
  }, [isLiveActive, currentLang, isTranslateMode, activeVenue.id]);

  const toggleLiveListening = () => {
    if (!isLiveActive) {
      setIsLiveActive(true);
      try { recognitionRef.current?.start(); } catch (e) {}
    } else {
      setIsLiveActive(false);
      try { recognitionRef.current?.stop(); } catch (e) {}
      setLiveStreamText('');
      setSmartReplies([]);
    }
  };

  // 🔊 CRITICAL FIX: Cross-platform Text-To-Speech
  const speakSentence = (text: string, forcedLang?: string) => {
    const lang = forcedLang || currentLang;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      window.speechSynthesis.speak(u);
    } else {
      Speech.stop();
      Speech.speak(text, { language: lang });
    }
  };

  const handleSelectOption = (reply: any) => {
    let displayToClerk = reply.clerkText;
    let speechLang = 'zh-TW'; 

    setClerkMessage(displayToClerk);
    speakSentence(displayToClerk, speechLang);
    setSmartReplies([]); 
  };

  const scanLiveLocation = async () => {
    setIsAutoDetecting(true);
    setNearbyVenueFound(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setIsAutoDetecting(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      
      const query = `[out:json][timeout:6];(node(around:20,${latitude},${longitude})["amenity"];node(around:20,${latitude},${longitude})["shop"];);out body 1;`;
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (data?.elements?.length > 0) {
        const poi = data.elements[0];
        const rawName = poi.tags['name:zh'] || poi.tags.name || 'Local Store';
        const type = poi.tags['shop'] || poi.tags['amenity'];
        
        let translatedName = rawName;
        if (isTranslateMode && currentLang === 'en-US') {
           translatedName = await realTranslate(rawName, 'zh-TW', 'en-US');
        }

        let matchedCategory = 'other';
        if (type === 'convenience' || type === 'supermarket') matchedCategory = 'cvs';
        else if (type === 'cafe' || type === 'beverages') matchedCategory = 'drink';
        else if (type === 'pharmacy' || type === 'clinic' || type === 'hospital') matchedCategory = 'pharmacy';
        else if (type === 'hairdresser') matchedCategory = 'salon';

        const baseStore = STORES_DATA.find(s => s.id === matchedCategory) || STORES_DATA[7];
        const newDynamicVenue = {
          id: matchedCategory, 
          name: { 'zh-TW': rawName, 'en-US': translatedName }, 
          short: translatedName.substring(0, 10),
          emoji: '📍',
          coverImage: baseStore.coverImage,
          mochi: baseStore.mochi
        };
        
        setNearbyVenueFound(newDynamicVenue);
        setTimeout(() => setNearbyVenueFound((prev: any) => prev?.id === newDynamicVenue.id ? null : prev), 15000); 
      }
    } catch (e) {}
    setIsAutoDetecting(false);
  };

  const handleMochiChatSubmit = async () => {
    if (mochiInputText.trim()) {
      const userText = mochiInputText.trim();
      setMochiInputText('');
      setMochiChat(prev => [...prev, { role: 'user', text: userText }]);
      setIsMochiTyping(true);
      const aiResponse = await fetchGeminiResponse(userText);
      setMochiChat(prev => [...prev, { role: 'model', text: aiResponse }]);
      setIsMochiTyping(false);
    }
  };

  const handleTypeToClerkSubmit = async () => {
    if (mochiInputText.trim()) {
      let finalSpeech = mochiInputText.trim();
      let speechLang = currentLang;

      if (isTranslateMode && currentLang === 'en-US') {
        finalSpeech = await realTranslate(finalSpeech, 'en-US', 'zh-TW');
        speechLang = 'zh-TW';
      }
      setClerkMessage(finalSpeech);
      speakSentence(finalSpeech, speechLang);
      setMochiInputText('');
      setIsTypeToClerkOpen(false);
    }
  };

  const activeBotMedia = isLiveActive ? LOCAL_BOT_ASSETS.listen : (activeVenue.mochi || LOCAL_BOT_ASSETS.floating);

  if (!isCounterMode) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]} onLayout={(e) => { containerSizeRef.current = e.nativeEvent.layout; }}>
        
        <View style={styles.homeHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 18 }}>💬</Text>
            <Text style={styles.homeTitleLogo}>{currentLang === 'zh-TW' ? '默契' : 'Tacit'}</Text>
          </View>
          
          <View style={styles.topRightControls}>
            <TouchableOpacity onPress={scanLiveLocation} style={styles.iconBtn}>
              {isAutoDetecting ? <ActivityIndicator size="small" color={THEME.orange} /> : <Text style={styles.iconText}>🛰️</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsTranslateMode(!isTranslateMode)} style={[styles.iconBtn, isTranslateMode && { backgroundColor: 'rgba(10, 132, 255, 0.2)', borderColor: THEME.translateAccent }]}>
              <Text style={[styles.iconText, isTranslateMode && { color: THEME.translateAccent, fontWeight: '700' }]}>A/文</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={styles.iconBtn}>
              <Text style={styles.iconText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {nearbyVenueFound && (
          <View style={{ width: '100%', alignItems: 'flex-end', marginBottom: 12, paddingRight: 4, zIndex: 50 }}>
            <TouchableOpacity style={styles.nearbyPopupPill} onPress={() => { setActiveVenue(nearbyVenueFound); setNearbyVenueFound(null); }}>
              <View style={styles.nearbyPulseDot} />
              <Text style={styles.nearbyPopupText}>{currentLang === 'zh-TW' ? '附近偵測: ' : 'Nearby: '}{nearbyVenueFound.name[currentLang] || nearbyVenueFound.name['zh-TW']} 〉</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.greetingSection}>
            <Text style={styles.greetingTitle}>{currentLang === 'zh-TW' ? '午安' : 'Good Afternoon'}</Text>
            <Text style={styles.greetingSub}>{currentLang === 'zh-TW' ? '今天要去哪裡？' : 'Where are you heading today?'}</Text>
          </View>

          <View style={styles.heroCard}>
            <Image source={{ uri: getActiveCoverImage() }} style={styles.heroImageCentered} />
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>{activeVenue.name[currentLang] || activeVenue.name['zh-TW']}</Text>
              <TouchableOpacity style={styles.startModeBtn} onPress={() => { setClerkMessage(''); setIsCounterMode(true); }}>
                <Text style={styles.startModeBtnText}>{currentLang === 'zh-TW' ? '開始櫃檯模式' : 'Start Counter Mode'}</Text>
              </TouchableOpacity>
              <Text style={styles.heroHint}>{currentLang === 'zh-TW' ? '手機平放在櫃檯上，橘色那半朝店員。' : 'Place flat on counter, orange half facing clerk.'}</Text>
            </View>
          </View>

          <View style={styles.carouselSection}>
            <Text style={styles.carouselTitle}>{currentLang === 'zh-TW' ? '換一種櫃檯' : 'Change Location'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselScroll}>
              {venues.map((v) => (
                <TouchableOpacity key={v.id} style={styles.carouselItem} onPress={() => setActiveVenue(v)}>
                  <Image source={{ uri: customWallpapers[v.id] || v.coverImage }} style={[styles.carouselItemImg, activeVenue.id === v.id && styles.carouselItemImgActive]} />
                  <Text style={[styles.carouselItemText, activeVenue.id === v.id && { color: THEME.orange, fontWeight: 'bold' }]}>{v.short}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={[styles.roamingMochi, { left: roamPos.x, top: roamPos.y }]}>
          <TouchableOpacity style={styles.mochiOrb} onPress={() => setIsMochiChatOpen(true)}>
            <MochiMediaPlayer source={activeBotMedia} />
          </TouchableOpacity>
        </View>

        <Modal visible={isSettingsOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <ScrollView style={styles.settingsModalCardFull} contentContainerStyle={{padding: 24}} showsVerticalScrollIndicator={false}>
              <View style={styles.settingsHeader}>
                 <TouchableOpacity onPress={() => setIsSettingsOpen(false)}><Text style={{color: THEME.text, fontSize: 24}}>←</Text></TouchableOpacity>
                 <Text style={styles.settingsModalTitle}>{currentLang === 'zh-TW' ? '設定' : 'Settings'}</Text>
                 <View style={{width: 24}} />
              </View>

              <Text style={styles.settingsSectionTitle}>{currentLang === 'zh-TW' ? '字體大小' : 'Font Size'}</Text>
              <View style={{flexDirection: 'row', gap: 10, marginBottom: 16}}>
                 {[{label: 'A-', val: 0.9}, {label: 'A', val: 1}, {label: 'A+', val: 1.15}].map(f => (
                   <TouchableOpacity key={f.label} style={[styles.fontBtn, fontScale === f.val && {backgroundColor: THEME.orange, borderColor: THEME.orange}]} onPress={() => setFontScale(f.val)}>
                      <Text style={[styles.fontBtnText, fontScale === f.val && {color: '#000'}]}>{f.label}</Text>
                   </TouchableOpacity>
                 ))}
              </View>

              <View style={styles.settingsDivider} />
              
              <Text style={styles.settingsSectionTitle}>{currentLang === 'zh-TW' ? '翻譯設定' : 'Translation'}</Text>
              <View style={styles.settingRow}>
                <Text style={styles.settingRowLabel}>{currentLang === 'zh-TW' ? 'A/文 翻譯模式' : 'A/文 Translate Mode'}</Text>
                <TouchableOpacity style={[styles.toggleSwitch, isTranslateMode && styles.toggleSwitchActive]} onPress={() => setIsTranslateMode(!isTranslateMode)}>
                  <View style={[styles.toggleThumb, isTranslateMode && styles.toggleThumbActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.settingsDivider} />
              
              <Text style={styles.settingsSectionTitle}>{currentLang === 'zh-TW' ? '介面語言' : 'Interface Language'}</Text>
              {LANGUAGE_LIST.map((lang) => (
                <TouchableOpacity key={lang.code} style={[styles.langOptionItem, currentLang === lang.code && { backgroundColor: THEME.surfaceLight }]} onPress={() => { setCurrentLang(lang.code as SupportedLang); setIsSettingsOpen(false); }}>
                  <Text style={[styles.langOptionText, currentLang === lang.code && { color: THEME.orange, fontWeight: 'bold' }]}>{lang.name}</Text>
                  {currentLang === lang.code && <Text style={{ color: THEME.orange, fontWeight: 'bold' }}>✓</Text>}
                </TouchableOpacity>
              ))}

              <View style={styles.settingsDivider} />
              
              <Text style={styles.settingsSectionTitle}>{currentLang === 'zh-TW' ? '自訂桌布 (Wallpaper)' : 'Custom Wallpaper URL'}</Text>
              <Text style={styles.settingHint}>{currentLang === 'zh-TW' ? `貼上圖片網址以更改 ${activeVenue.name['zh-TW']} 的背景` : `Paste URL to override image for ${activeVenue.name['en-US']}`}</Text>
              <TextInput style={[styles.inputField, {marginBottom: 8}]} placeholder="https://..." placeholderTextColor={THEME.textMuted} value={wallpaperInputUrl} onChangeText={setWallpaperInputUrl} />
              <TouchableOpacity style={styles.sendBtn} onPress={saveCustomWallpaper}>
                <Text style={styles.sendBtnText}>{currentLang === 'zh-TW' ? '儲存背景' : 'Save Wallpaper'}</Text>
              </TouchableOpacity>
              
              <View style={{height: 60}} />
            </ScrollView>
          </View>
        </Modal>

        <Modal visible={isMochiChatOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.mochiChatCard}>
              <View style={styles.mochiChatHeader}>
                <Text style={styles.settingsModalTitle}>🐼 Mochi AI</Text>
                <TouchableOpacity onPress={() => setIsMochiChatOpen(false)}><Text style={{color: THEME.textMuted, fontSize: 20}}>×</Text></TouchableOpacity>
              </View>
              <ScrollView style={styles.chatScrollArea} contentContainerStyle={{paddingVertical: 10}} ref={scrollViewRef} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
                {mochiChat.map((msg, idx) => (
                  <View key={idx} style={[styles.chatBubbleContainer, msg.role === 'user' ? {justifyContent: 'flex-end'} : {justifyContent: 'flex-start'}]}>
                    <View style={[styles.chatBubble, msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleModel]}>
                      <Text style={[styles.chatText, msg.role === 'user' ? {color: '#FFF'} : {color: THEME.text}]}>{msg.text}</Text>
                    </View>
                    {msg.role === 'model' && (
                      <TouchableOpacity style={styles.chatSpeakIcon} onPress={() => speakSentence(msg.text)}>
                        <Text style={{fontSize: 14}}>🔊</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {isMochiTyping && (
                  <View style={[styles.chatBubbleContainer, {justifyContent: 'flex-start'}]}>
                    <View style={[styles.chatBubble, styles.chatBubbleModel]}><ActivityIndicator size="small" color={THEME.textMuted} /></View>
                  </View>
                )}
              </ScrollView>
              <View style={styles.chatInputRow}>
                <TextInput style={styles.chatInputField} placeholder={currentLang === 'zh-TW' ? '輸入訊息...' : 'Message Mochi...'} placeholderTextColor={THEME.textMuted} value={mochiInputText} onChangeText={setMochiInputText} onSubmitEditing={handleMochiChatSubmit} />
                <TouchableOpacity style={styles.chatSendBtn} onPress={handleMochiChatSubmit}>
                  <Text style={{color: '#000', fontWeight: '800'}}>↑</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      
      <View style={[styles.splitTop, { paddingTop: insets.bottom }]}>
        <View style={styles.splitTopInner}>
          <Text style={[styles.clerkFacingSub, {fontSize: 20 * fontScale}]}>{currentLang === 'zh-TW' ? '您好' : 'Hello'}</Text>
          <Text style={[styles.clerkFacingHint, {fontSize: 14 * fontScale}]}>{currentLang === 'zh-TW' ? '這一面朝向店員' : 'This side faces the clerk'}</Text>
          
          <View style={styles.clerkMainMessageContainer}>
            {clerkMessage ? (
              <>
                <Text style={[styles.clerkMainMessageLarge, {fontSize: 36 * fontScale}]} adjustsFontSizeToFit numberOfLines={4}>{clerkMessage}</Text>
                <Text style={[styles.clerkSecondaryMessage, {fontSize: 18 * fontScale}]}>
                  {currentLang === 'zh-TW' ? '請直接對手機說話' : 'Please speak directly to the phone'}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.clerkDefaultHeadline, {fontSize: 42 * fontScale}]}>{currentLang === 'zh-TW' ? '我是聽障者' : 'I am D/HH'}</Text>
                <Text style={[styles.clerkDefaultHeadline, {fontSize: 42 * fontScale}]}>{currentLang === 'zh-TW' ? '請對著手機說話' : 'Please speak to the phone'}</Text>
                <Text style={[styles.clerkDefaultSub, {fontSize: 20 * fontScale}]}>{currentLang === 'zh-TW' ? '我會用螢幕回答您' : 'I will answer via screen'}</Text>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={styles.splitDivider} />

      <View style={[styles.splitBottom, { paddingBottom: insets.bottom }]}>
        <View style={styles.bottomHeaderGroup}>
           <View style={styles.bottomHeader}>
              <TouchableOpacity style={styles.venueDropdown} onPress={() => setIsCounterMode(false)}>
                <Text style={styles.venueDropdownText}>{activeVenue.emoji} {activeVenue.short} ▾</Text>
              </TouchableOpacity>
              <View style={{flexDirection: 'row', gap: 6}}>
                 {isTranslateMode && (
                    <View style={[styles.liveStatusPill, { borderColor: THEME.translateAccent }]}>
                      <Text style={[styles.liveStatusText, { color: THEME.translateAccent }]}>A/文</Text>
                    </View>
                 )}
                 <TouchableOpacity style={styles.liveStatusPill} onPress={toggleLiveListening}>
                    <Text style={styles.liveStatusDot}>{isLiveActive ? '🟢' : '⚪'}</Text>
                    <Text style={styles.liveStatusText}>
                      {isLiveActive ? (currentLang === 'zh-TW' ? '正在聽' : 'Listening') : (currentLang === 'zh-TW' ? '已暫停' : 'Paused')}
                    </Text>
                 </TouchableOpacity>
              </View>
           </View>

           {smartReplies.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                 {smartReplies.map((reply: any) => (
                    <TouchableOpacity key={reply.id} style={styles.smartReplyBtn} onPress={() => handleSelectOption(reply)}>
                       <Text style={styles.smartReplyBtnText}>💡 {reply.text}</Text>
                    </TouchableOpacity>
                 ))}
              </ScrollView>
           )}

           {liveStreamText ? (
             <View style={styles.liveSubtitleBox}>
               {isTranslateMode && currentLang === 'en-US' && <Text style={{fontSize: 10, color: THEME.translateAccent, marginBottom: 2}}>A/文 Translated</Text>}
               <Text style={[styles.liveSubtitleText, {fontSize: 15 * fontScale}]}>"{liveStreamText}"</Text>
             </View>
           ) : null}
        </View>

        <ScrollView style={styles.questionsList} contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
          {CARDS_DATA.filter(c => c.stores.includes('*') || c.stores.includes(activeVenue.id)).map((card) => (
             card.options.map((opt, idx) => (
              <TouchableOpacity key={`${card.id}_${idx}`} style={styles.questionRow} onPress={() => handleSelectOption({ clerkText: opt.tts || opt.labels['zh-TW'] })}>
                <View style={styles.questionTextCol}>
                  <Text style={[styles.questionTitle, {fontSize: 18 * fontScale}]}>{opt.labels[currentLang] || opt.labels['zh-TW']}</Text>
                  {opt.subLabels && <Text style={[styles.questionSub, {fontSize: 13 * fontScale}]}>{opt.subLabels[currentLang] || opt.subLabels['zh-TW']}</Text>}
                </View>
                <Text style={styles.questionArrow}>›</Text>
              </TouchableOpacity>
             ))
          ))}
          
          <TouchableOpacity style={styles.questionRow} onPress={() => setIsSOSOpen(true)}>
             <View style={styles.questionTextCol}>
                <Text style={[styles.questionTitle, { color: THEME.danger, fontSize: 18 * fontScale }]}>{currentLang === 'zh-TW' ? '緊急求助 (SOS)' : 'Medical SOS'}</Text>
                <Text style={[styles.questionSub, {fontSize: 13 * fontScale}]}>{currentLang === 'zh-TW' ? '需要醫療協助' : 'Need medical help'}</Text>
              </View>
              <Text style={styles.questionArrow}>›</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity style={styles.mochiOrbCounterMode} onPress={() => setIsMochiChatOpen(true)}>
          <MochiMediaPlayer source={activeBotMedia} />
        </TouchableOpacity>

        <View style={styles.bottomActionBar}>
          <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => clerkMessage && speakSentence(clerkMessage, 'zh-TW')}>
            <Text style={styles.actionBtnSecondaryText}>↶ {currentLang === 'zh-TW' ? '可以再說一次嗎？' : 'Say Again'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setIsTypeToClerkOpen(true)}>
            <Text style={styles.actionBtnPrimaryText}>💬 {currentLang === 'zh-TW' ? '打字' : 'Type'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={isTypeToClerkOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.mochiModalCard}>
            <Text style={styles.settingsModalTitle}>
               💬 {currentLang === 'zh-TW' ? '打字給對方看' : 'Type to Clerk'}
               {isTranslateMode && currentLang === 'en-US' && <Text style={{color: THEME.translateAccent, fontSize: 12}}> (Auto-Translate)</Text>}
            </Text>
            <TextInput
              style={styles.inputField}
              placeholder={currentLang === 'zh-TW' ? '輸入文字...' : 'Type text...'}
              placeholderTextColor={THEME.textMuted}
              value={mochiInputText}
              onChangeText={setMochiInputText}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleTypeToClerkSubmit}>
              <Text style={styles.sendBtnText}>送出並發音 (Send & Speak)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.closeBtn, { marginTop: 8 }]} onPress={() => setIsTypeToClerkOpen(false)}>
              <Text style={styles.closeBtnText}>關閉 (Close)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isMochiChatOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.mochiChatCard}>
            <View style={styles.mochiChatHeader}>
              <Text style={styles.settingsModalTitle}>🐼 Mochi AI</Text>
              <TouchableOpacity onPress={() => setIsMochiChatOpen(false)}><Text style={{color: THEME.textMuted, fontSize: 20}}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.chatScrollArea} contentContainerStyle={{paddingVertical: 10}} ref={scrollViewRef} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
              {mochiChat.map((msg, idx) => (
                <View key={idx} style={[styles.chatBubbleContainer, msg.role === 'user' ? {justifyContent: 'flex-end'} : {justifyContent: 'flex-start'}]}>
                  <View style={[styles.chatBubble, msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleModel]}>
                    <Text style={[styles.chatText, msg.role === 'user' ? {color: '#FFF'} : {color: THEME.text}]}>{msg.text}</Text>
                  </View>
                  {msg.role === 'model' && (
                    <TouchableOpacity style={styles.chatSpeakIcon} onPress={() => speakSentence(msg.text)}>
                      <Text style={{fontSize: 14}}>🔊</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {isMochiTyping && (
                <View style={[styles.chatBubbleContainer, {justifyContent: 'flex-start'}]}>
                  <View style={[styles.chatBubble, styles.chatBubbleModel]}><ActivityIndicator size="small" color={THEME.textMuted} /></View>
                </View>
              )}
            </ScrollView>
            <View style={styles.chatInputRow}>
              <TextInput style={styles.chatInputField} placeholder={currentLang === 'zh-TW' ? '輸入訊息...' : 'Message Mochi...'} placeholderTextColor={THEME.textMuted} value={mochiInputText} onChangeText={setMochiInputText} onSubmitEditing={handleMochiChatSubmit} />
              <TouchableOpacity style={styles.chatSendBtn} onPress={handleMochiChatSubmit}>
                <Text style={{color: '#000', fontWeight: '800'}}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isSOSOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={{ width: '90%', maxWidth: 460 }}>
            <View style={styles.sosCardFull}>
              <View style={styles.sosCardHeader}>
                <Text style={{fontSize: 24}}>🚨</Text>
                <Text style={styles.sosTitle}>{currentLang === 'zh-TW' ? '緊急醫療求助' : 'Medical SOS'}</Text>
              </View>
              <View style={styles.sosInfoBox}>
                <View style={styles.sosInfoRow}>
                   <Text style={styles.sosTextKey}>Name:</Text>
                   <Text style={styles.sosTextValue}>Udhayaraj (Raj)</Text>
                </View>
                <View style={styles.sosInfoRow}>
                   <Text style={styles.sosTextKey}>Blood:</Text>
                   <Text style={styles.sosTextValue}>O+</Text>
                </View>
                <Text style={styles.sosQuote}>"I am having a medical emergency. Please read my screen."</Text>
              </View>
              <TouchableOpacity style={styles.sosSpeakBtn} onPress={() => speakSentence('我現在有緊急醫療狀況，請幫助我。', 'zh-TW')}>
                <Text style={styles.sosSpeakBtnText}>🔊 播放求助語音</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sosCloseBtn} onPress={() => setIsSOSOpen(false)}>
                <Text style={styles.sosCloseBtnText}>關閉 (Close)</Text>
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
  container: { width: '100%', maxWidth: 520, flex: 1, paddingHorizontal: 16, alignSelf: 'center' },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 10, paddingHorizontal: 16 },
  homeTitleLogo: { fontSize: 18, fontWeight: '700', color: THEME.text, fontFamily: THEME.fontFamily },
  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 6, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18, color: THEME.textMuted, fontWeight: '700' },
  nearbyPopupPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52, 199, 89, 0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: THEME.success },
  nearbyPulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.success, marginRight: 8 },
  nearbyPopupText: { color: THEME.success, fontSize: 12, fontWeight: '700', fontFamily: THEME.fontFamily },
  
  mainScroll: { flex: 1 },
  greetingSection: { marginBottom: 24, marginTop: 12, paddingHorizontal: 16 },
  greetingTitle: { fontSize: 32, fontWeight: '800', color: THEME.text, marginBottom: 4, fontFamily: THEME.fontFamily },
  greetingSub: { fontSize: 18, fontWeight: '500', color: THEME.textMuted, fontFamily: THEME.fontFamily },
  
  heroCard: { backgroundColor: THEME.surface, borderRadius: 24, overflow: 'hidden', marginBottom: 28, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', marginHorizontal: 16 },
  heroImageCentered: { width: '100%', height: 190, resizeMode: 'cover' },
  heroContent: { padding: 20, width: '100%' },
  heroTitle: { fontSize: 24, fontWeight: '700', color: THEME.text, marginBottom: 14, fontFamily: THEME.fontFamily },
  startModeBtn: { backgroundColor: THEME.text, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12, width: '100%' },
  startModeBtnText: { color: THEME.bg, fontSize: 16, fontWeight: '700', fontFamily: THEME.fontFamily },
  heroHint: { fontSize: 12, color: THEME.textMuted, textAlign: 'center', fontFamily: THEME.fontFamily },
  
  carouselSection: { paddingLeft: 16 },
  carouselTitle: { fontSize: 16, fontWeight: '700', color: THEME.text, marginBottom: 14, fontFamily: THEME.fontFamily },
  carouselScroll: { gap: 14, paddingBottom: 20 },
  carouselItem: { alignItems: 'center', width: 80 },
  carouselItemImg: { width: 72, height: 72, borderRadius: 16, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  carouselItemImgActive: { borderColor: THEME.orange },
  carouselItemText: { fontSize: 12, color: THEME.textMuted, fontWeight: '500', fontFamily: THEME.fontFamily },
  
  splitTop: { flex: 1, backgroundColor: THEME.orange, justifyContent: 'center', alignItems: 'center' },
  splitTopInner: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 24, transform: [{ rotate: '180deg' }] },
  clerkFacingSub: { fontWeight: '800', color: '#000', marginBottom: 4, fontFamily: THEME.fontFamily },
  clerkFacingHint: { fontWeight: '600', color: 'rgba(0,0,0,0.6)', marginBottom: 32, fontFamily: THEME.fontFamily },
  clerkMainMessageContainer: { alignItems: 'center', justifyContent: 'center' },
  clerkDefaultHeadline: { fontWeight: '900', color: '#000', textAlign: 'center', lineHeight: 52, letterSpacing: -1, fontFamily: THEME.fontFamily },
  clerkDefaultSub: { fontWeight: '700', color: 'rgba(0,0,0,0.7)', marginTop: 24, fontFamily: THEME.fontFamily },
  clerkMainMessageLarge: { fontWeight: '900', color: '#000', textAlign: 'center', lineHeight: 46, fontFamily: THEME.fontFamily },
  clerkSecondaryMessage: { fontWeight: '700', color: 'rgba(0,0,0,0.6)', marginTop: 16, fontFamily: THEME.fontFamily },
  splitDivider: { height: 4, backgroundColor: THEME.orange },
  splitBottom: { flex: 1.2, backgroundColor: THEME.bg, paddingHorizontal: 16, paddingTop: 16 },
  
  bottomHeaderGroup: { marginBottom: 12, zIndex: 10 },
  bottomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  venueDropdown: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: THEME.border },
  venueDropdownText: { color: THEME.text, fontSize: 15, fontWeight: '600', fontFamily: THEME.fontFamily },
  liveStatusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, gap: 6 },
  liveStatusDot: { fontSize: 10 },
  liveStatusText: { color: THEME.text, fontSize: 14, fontWeight: '600', fontFamily: THEME.fontFamily },
  
  liveSubtitleBox: { backgroundColor: THEME.surfaceLight, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: THEME.success },
  liveSubtitleText: { color: THEME.success, fontWeight: '600', fontFamily: THEME.fontFamily },
  smartReplyBtn: { backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  smartReplyBtnText: { color: THEME.text, fontSize: 12, fontWeight: '600' },
  questionsList: { flex: 1 },
  questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
  questionTextCol: { flex: 1, gap: 4 },
  questionTitle: { fontWeight: '600', color: THEME.text, fontFamily: THEME.fontFamily },
  questionSub: { color: THEME.textMuted, fontFamily: THEME.fontFamily },
  questionArrow: { fontSize: 24, color: THEME.textMuted },
  bottomActionBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 4, backgroundColor: THEME.bg },
  actionBtnSecondary: { flex: 1.5, backgroundColor: THEME.surface, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
  actionBtnSecondaryText: { color: THEME.text, fontSize: 16, fontWeight: '600', fontFamily: THEME.fontFamily },
  actionBtnPrimary: { flex: 1, backgroundColor: THEME.surfaceLight, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  actionBtnPrimaryText: { color: THEME.text, fontSize: 16, fontWeight: '600', fontFamily: THEME.fontFamily },
  
  roamingMochi: { position: 'absolute', zIndex: 99, alignItems: 'center' },
  mochiOrb: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: THEME.surface, overflow: 'hidden', backgroundColor: THEME.bg },
  mochiOrbCounterMode: { position: 'absolute', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: THEME.border, overflow: 'hidden', backgroundColor: THEME.bg, zIndex: 100 },
  
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  settingsModalCardFull: { width: '100%', height: '100%', backgroundColor: THEME.bg },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  settingsModalTitle: { fontSize: 20, fontWeight: '700', color: THEME.text, fontFamily: THEME.fontFamily },
  settingsSectionTitle: { fontSize: 18, fontWeight: '700', color: THEME.text, marginBottom: 12, marginTop: 12 },
  settingListItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
  fontBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: THEME.border, alignItems: 'center' },
  fontBtnText: { color: THEME.text, fontSize: 16, fontWeight: '600' },
  
  mochiModalCard: { width: '90%', maxWidth: 360, borderRadius: 20, padding: 24, backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.border },
  mochiChatCard: { width: '95%', maxWidth: 460, height: '75%', borderRadius: 24, backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.border, overflow: 'hidden' },
  mochiChatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
  chatScrollArea: { flex: 1, paddingHorizontal: 16 },
  chatBubbleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  chatBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  chatBubbleUser: { backgroundColor: THEME.orange, borderBottomRightRadius: 4 },
  chatBubbleModel: { backgroundColor: THEME.surfaceLight, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: THEME.border },
  chatText: { fontSize: 15, lineHeight: 20, fontFamily: THEME.fontFamily },
  chatSpeakIcon: { padding: 8, backgroundColor: THEME.surfaceLight, borderRadius: 20, borderWidth: 1, borderColor: THEME.border },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.bg },
  chatInputField: { flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: THEME.surfaceLight, paddingHorizontal: 16, fontSize: 15, color: THEME.text },
  chatSendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.orange, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

  langOptionItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginBottom: 8, backgroundColor: THEME.bg },
  langOptionText: { fontSize: 15, color: THEME.text, fontFamily: THEME.fontFamily },
  settingsDivider: { height: 1, backgroundColor: THEME.border, marginVertical: 24 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  settingRowLabel: { color: THEME.text, fontSize: 16, fontWeight: '500' },
  toggleSwitch: { width: 48, height: 26, borderRadius: 13, backgroundColor: THEME.bg, borderWidth: 1, borderColor: THEME.border, justifyContent: 'center', padding: 2 },
  toggleSwitchActive: { backgroundColor: THEME.translateAccent, borderColor: THEME.translateAccent },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: THEME.textMuted },
  toggleThumbActive: { backgroundColor: '#FFF', transform: [{ translateX: 22 }] },
  settingHint: { color: THEME.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  closeBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  closeBtnText: { fontSize: 14, fontWeight: '600', color: THEME.textMuted, fontFamily: THEME.fontFamily },

  inputField: { width: '100%', minHeight: 56, borderRadius: 10, backgroundColor: THEME.bg, borderWidth: 1, borderColor: THEME.border, padding: 14, fontSize: 15, color: THEME.text, marginBottom: 12 },
  sendBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, backgroundColor: THEME.orange, alignItems: 'center' },
  sendBtnText: { color: '#000', fontSize: 15, fontWeight: '700', fontFamily: THEME.fontFamily },

  sosCardFull: { backgroundColor: '#FF3B30', borderRadius: 20, padding: 24 },
  sosCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sosTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', fontFamily: THEME.fontFamily },
  sosInfoBox: { backgroundColor: '#CC2E26', borderRadius: 12, padding: 16, marginBottom: 20 },
  sosInfoRow: { flexDirection: 'row', marginBottom: 6 },
  sosTextKey: { color: 'rgba(255,255,255,0.7)', fontSize: 15, width: 60 },
  sosTextValue: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  sosQuote: { color: '#FFF', fontSize: 15, marginTop: 12, lineHeight: 22, fontStyle: 'italic' },
  sosSpeakBtn: { backgroundColor: '#FFF', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  sosSpeakBtnText: { color: '#FF3B30', fontSize: 16, fontWeight: '800' },
  sosCloseBtn: { paddingVertical: 12, alignItems: 'center' },
  sosCloseBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' }
});