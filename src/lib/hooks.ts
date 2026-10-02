import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

type TimerId = ReturnType<typeof setTimeout>;

/** 一組計時器：離開畫面時自動全部取消，不會在背景亂跑 */
export function useTimers() {
  const [ids] = useState(() => new Set<TimerId>());
  useEffect(
    () => () => {
      ids.forEach(clearTimeout);
      ids.clear();
    },
    [ids]
  );
  return useMemo(
    () => ({
      after(ms: number, fn: () => void) {
        const id = setTimeout(() => {
          ids.delete(id);
          fn();
        }, ms);
        ids.add(id);
        return id;
      },
      cancel(id: TimerId | null | undefined) {
        if (id == null) return;
        clearTimeout(id);
        ids.delete(id);
      },
      clear() {
        ids.forEach(clearTimeout);
        ids.clear();
      },
    }),
    [ids]
  );
}

/** 量某個元素的大小，視窗轉向或縮放時會自動更新（onResize 會在大小改變時被呼叫） */
export function useElementSize<T extends HTMLElement>(onResize?: (width: number, height: number) => void) {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const callback = useRef(onResize);
  useEffect(() => {
    callback.current = onResize;
  });
  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
      callback.current?.(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  const ref = useCallback((node: T | null) => setEl(node), []);
  return [ref, size] as const;
}

/** 玩遊戲時讓螢幕保持亮著 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // 省電模式下可能會被拒絕，不影響遊戲
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}

/** 頁面被切到背景（接電話、關螢幕）時暫停 */
export function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/**
 * 滿版排法：找出格子最大的欄數，再把格子撐滿整個空間。
 * 格子寬高比可以在 minRatio～maxRatio 之間伸縮，超出才留邊。
 */
export function fitGrid(n: number, W: number, H: number, gap: number, o: { ratio: number; minRatio: number; maxRatio: number }) {
  let best = { cols: 1, rows: n, w: 44, h: 44, score: -1 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    if (cols * rows - n >= cols) continue;
    let w = (W - gap * (cols - 1)) / cols;
    let h = (H - gap * (rows - 1)) / rows;
    if (w / h > o.maxRatio) w = h * o.maxRatio;
    else if (w / h < o.minRatio) h = w / o.minRatio;
    // 越大越好；形狀越接近理想比例越好；排不滿的稍微扣分
    const shape = Math.abs(Math.log(w / h / o.ratio));
    const score = w * h * (cols * rows === n ? 1 : 0.85) * (1 - Math.min(0.3, shape * 0.4));
    if (score > best.score) best = { cols, rows, w, h, score };
  }
  return { cols: best.cols, rows: best.rows, w: Math.floor(Math.max(44, best.w)), h: Math.floor(Math.max(44, best.h)) };
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
