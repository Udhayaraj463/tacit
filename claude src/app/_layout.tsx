import { AtkinsonHyperlegibleMono_500Medium } from '@expo-google-fonts/atkinson-hyperlegible-mono/500Medium';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider, useSettings } from '../state/settings';
import { PhoneFrame } from '../ui/PhoneFrame';
import { useColors } from '../ui/theme';

function Navigator() {
  const c = useColors();
  const { ready } = useSettings();
  if (!ready) return null;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.ground },
        headerTintColor: c.ink,
        headerTitleStyle: { fontWeight: '500' },
        headerShadowVisible: false,
        headerBackTitle: '返回',
        contentStyle: { backgroundColor: c.ground },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: '看得見的對話' }} />
      <Stack.Screen name="counter" options={{ headerShown: false, title: '櫃檯模式', gestureEnabled: false }} />
      <Stack.Screen name="settings" options={{ title: '設定' }} />
      <Stack.Screen name="records" options={{ title: '紀錄' }} />
    </Stack>
  );
}

export default function RootLayout() {
  // 字體載入失敗時仍照常顯示（退回系統字體）
  const [loaded, error] = useFonts({ AtkinsonHyperlegibleMono_500Medium });
  if (!loaded && !error) return null;
  return (
    <PhoneFrame>
      <SafeAreaProvider>
        <SettingsProvider>
          <Navigator />
        </SettingsProvider>
      </SafeAreaProvider>
    </PhoneFrame>
  );
}
