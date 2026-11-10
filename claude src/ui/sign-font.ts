// 店員面字體：思源黑體 Medium（使用者選的）。字檔約 7MB，背景載入；載好之前先用系統字體。
import { NotoSansTC_500Medium } from '@expo-google-fonts/noto-sans-tc/500Medium';
import { useFonts } from 'expo-font';
import { fonts } from './theme';

export function useSignFace() {
  const [ready] = useFonts({ NotoSansTC_500Medium });
  return ready ? { fontFamily: fonts.sign, fontWeight: 'normal' as const } : null;
}
