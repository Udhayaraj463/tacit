// 產品標誌：兩個對話框，櫃檯兩邊的兩個人（品牌暖橘）。原始檔在 assets/brand/src/mark.svg。
import { Image } from 'react-native';

const MARK = require('../../assets/brand/mark.png');

export function Mark({ size = 28 }: { size?: number }) {
  return <Image source={MARK} style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no" />;
}
