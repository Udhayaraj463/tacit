import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type StoreCategory = 'convenience' | 'cafe' | 'pharmacy' | 'general';

export interface LocationState {
  currentCountry: string;
  clerkLanguage: string;
  storeCategory: StoreCategory;
  storeName: string;
  vocabulary: string[];
}

const STORE_VOCABULARIES: Record<StoreCategory, string[]> = {
  convenience: ['載具', '會員', '統編', '微波', '自備杯', '折價券', '塑膠袋', '全家', '7-11', '發票'],
  cafe: ['內用', '外帶', '自備杯', '冰塊', '甜度', '燕麥奶', '特大杯', '紙袋'],
  pharmacy: ['健保卡', '處方簽', '飯前', '飯後', '自費', '劑量', '原廠藥'],
  general: ['刷卡', '現金', 'Line Pay', '載具', '統編', '明細']
};

interface LocationContextType {
  locationState: LocationState;
  overrideCategory: (cat: StoreCategory) => void;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locationState, setLocationState] = useState<LocationState>({
    currentCountry: 'TW',
    clerkLanguage: 'zh-TW',
    storeCategory: 'convenience',
    storeName: '7-ELEVEN',
    vocabulary: STORE_VOCABULARIES.convenience
  });

  const detectLocationAndContext = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (!geocode) return;

      const country = geocode.isoCountryCode || 'TW';
      let clerkLang = 'zh-TW';
      if (country === 'JP') clerkLang = 'ja-JP';
      else if (country === 'US') clerkLang = 'en-US';

      const name = (geocode.name || '').toLowerCase();
      let cat: StoreCategory = 'general';

      if (name.includes('7-11') || name.includes('seven') || name.includes('family') || name.includes('全家')) {
        cat = 'convenience';
      } else if (name.includes('cafe') || name.includes('starbucks') || name.includes('咖啡')) {
        cat = 'cafe';
      } else if (name.includes('pharmacy') || name.includes('藥局')) {
        cat = 'pharmacy';
      }

      setLocationState({
        currentCountry: country,
        clerkLanguage: clerkLang,
        storeCategory: cat,
        storeName: geocode.name || 'Nearby Store',
        vocabulary: STORE_VOCABULARIES[cat]
      });
    } catch {
      // Retain fallback defaults
    }
  };

  useEffect(() => {
    detectLocationAndContext();
  }, []);

  const overrideCategory = (cat: StoreCategory) => {
    setLocationState(prev => ({
      ...prev,
      storeCategory: cat,
      vocabulary: STORE_VOCABULARIES[cat]
    }));
  };

  return (
    <LocationContext.Provider value={{ locationState, overrideCategory, refreshLocation: detectLocationAndContext }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used within LocationProvider');
  return ctx;
};