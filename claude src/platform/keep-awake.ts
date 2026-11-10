// 櫃檯模式中螢幕不休眠。網頁版的 wake lock 可能還沒啟動就被釋放（例如分頁不在前景），
// 這時官方 hook 會直接丟錯，所以這裡全部吞掉：不休眠是加分，不能讓畫面壞掉。
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

const TAG = 'counter-mode';

export function useKeepScreenOn() {
  useEffect(() => {
    activateKeepAwakeAsync(TAG).catch(() => {});
    return () => {
      Promise.resolve()
        .then(() => deactivateKeepAwake(TAG))
        .catch(() => {});
    };
  }, []);
}
