// 網頁版在電腦上打開時，把整個 App 放進手機大小的框裡，跟手機一樣是直的。
// 用 iframe：框裡的螢幕寬度就是手機寬度，彈出的面板、店員點選、大字卡也都留在框裡。
// 手機、平板、已經在框裡、或網址加了 ?full 時照常全螢幕。
import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';

const MIN_DESKTOP_WIDTH = 700;
const PHONE = { width: 390, height: 844 };
const BEZEL = 10;

function shouldFrame(): boolean {
  if (window.self !== window.top) return false;
  if (new URLSearchParams(window.location.search).has('full')) return false;
  return window.innerWidth >= MIN_DESKTOP_WIDTH && window.matchMedia('(pointer: fine)').matches;
}

const subscribeResize = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
const noSubscribe = () => () => {};

export function PhoneFrame({ children }: { children: ReactNode }) {
  // 伺服器上不知道螢幕多大：先什麼都不畫，打開後才決定，免得 App 先在外面跑一次（例如開始收音）
  const mode = useSyncExternalStore(noSubscribe, () => (shouldFrame() ? 'frame' : 'app'), () => 'pending');
  const windowHeight = useSyncExternalStore(subscribeResize, () => window.innerHeight, () => PHONE.height);
  const height = Math.max(560, Math.min(PHONE.height, windowHeight - 96));

  if (mode === 'pending') return null;
  if (mode === 'app') return <>{children}</>;

  const { pathname, search } = window.location;
  return (
    <div style={styles.page}>
      <div style={{ ...styles.device, height: height + BEZEL * 2 }}>
        <iframe src={pathname + search} title="看得見的對話" allow="microphone; autoplay" style={{ ...styles.screen, height }} />
      </div>
      <p style={styles.caption}>
        這是手機上的樣子，用手機打開效果最好。
        <a href={`${pathname}?full`} style={styles.link}>
          改成整個視窗
        </a>
      </p>
    </div>
  );
}

const styles = {
  page: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: '#2a2826',
    fontFamily: 'system-ui, -apple-system, "PingFang TC", "Noto Sans TC", sans-serif',
  },
  device: {
    width: PHONE.width + BEZEL * 2,
    padding: BEZEL,
    boxSizing: 'border-box',
    borderRadius: 52,
    background: '#111',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
  },
  screen: { display: 'block', width: PHONE.width, border: 0, borderRadius: 42, background: '#F4F3F1' },
  caption: { margin: 0, fontSize: 14, color: '#bdb8b2', display: 'flex', gap: 12 },
  link: { color: '#FFC587' },
} satisfies Record<string, CSSProperties>;
