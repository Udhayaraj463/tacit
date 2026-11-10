// 手機上直接顯示；網頁版另有 PhoneFrame.web.tsx（電腦上放進手機大小的框）。
import type { ReactNode } from 'react';

export function PhoneFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
