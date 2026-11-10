// 雲端收音（只在網頁版）：iPhone Safari 不給用內建語音辨識時，自己錄音、切成一句一句，交給雲端轉文字。
// 錄音只存在記憶體裡，送出去就丟掉。
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { createVad } from './vad';
import { downsample, encodeWav, toBase64 } from './wav';

const TARGET_RATE = 16000;

type WebAudioWindow = {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

export const CLOUD_LISTEN_AVAILABLE =
  Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';

/** idle：沒在聽；listening：在聽；hearing：店員正在說；error：拿不到麥克風 */
export type CloudListenState = 'idle' | 'listening' | 'hearing' | 'error';

export function useCloudListener(onUtterance: (wavBase64: string) => void) {
  const [state, setState] = useState<CloudListenState>('idle');
  const [error, setError] = useState<string | null>(null);
  const onRef = useRef(onUtterance);
  const muted = useRef(false);
  const teardown = useRef<(() => void) | null>(null);

  useEffect(() => {
    onRef.current = onUtterance;
  }, [onUtterance]);

  const stop = useCallback(() => {
    teardown.current?.();
    teardown.current = null;
    setState('idle');
  }, []);

  /** 要在使用者點擊裡呼叫（Safari 規定） */
  const start = useCallback(async () => {
    if (!CLOUD_LISTEN_AVAILABLE || teardown.current) return;
    const w = globalThis as unknown as WebAudioWindow;
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) {
      setError('no-audio-context');
      setState('error');
      return;
    }
    // AudioContext 要在點擊的當下建立，等麥克風權限回來再建，Safari 會讓它一直暫停
    const ctx = new Ctx();
    void ctx.resume();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      void ctx.close();
      setError((e as { name?: string }).name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture');
      setState('error');
      return;
    }
    const source = ctx.createMediaStreamSource(stream);
    // ScriptProcessor 已不推薦，但 iPhone Safari 各版本都支援，也不用另外載入 worklet 檔
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const vad = createVad(ctx.sampleRate);
    proc.onaudioprocess = (e) => {
      if (muted.current) return;
      const frame = new Float32Array(e.inputBuffer.getChannelData(0));
      for (const ev of vad.push(frame)) {
        if (ev.type === 'start') setState('hearing');
        else {
          setState('listening');
          const wav = encodeWav(downsample(ev.samples, ctx.sampleRate, TARGET_RATE), TARGET_RATE);
          onRef.current(toBase64(wav));
        }
      }
    };
    source.connect(proc);
    proc.connect(ctx.destination);
    teardown.current = () => {
      proc.onaudioprocess = null;
      source.disconnect();
      proc.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    };
    setError(null);
    setState('listening');
  }, []);

  /** 自己唸答案時不收音 */
  const setMuted = useCallback((m: boolean) => {
    muted.current = m;
  }, []);

  useEffect(() => () => teardown.current?.(), []);

  return { state, error, start, stop, setMuted };
}
