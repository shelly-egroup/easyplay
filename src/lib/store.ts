import { useSyncExternalStore } from 'react';

// 進度存在瀏覽器裡（localStorage），換裝置不會跟著走
const PREFIX = 'easyplay.';
const listeners = new Set<() => void>();

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 無痕模式或儲存空間被封鎖時，進度只是不會被記住
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSavedLevel(id: string) {
  return Math.max(1, Math.floor(read(id + '.level', 1)) || 1);
}

export function saveLevel(id: string, level: number) {
  write(id + '.level', level);
}

/** 上次玩到第幾關；伺服器端預先產生畫面時還不知道，回傳 null */
export function useSavedLevel(id: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => getSavedLevel(id),
    () => null
  );
}
