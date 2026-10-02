import type { ReactNode } from 'react';

// 底部的小提示（例如「要找兩個以上連在一起的喔」）
export type ToastMessage = { id: number; content: ReactNode; ms: number };

let seq = 0;
const listeners = new Set<(msg: ToastMessage | null) => void>();

export function toast(content: ReactNode, ms = 3400) {
  const msg = { id: ++seq, content, ms };
  listeners.forEach((fn) => fn(msg));
}

export function clearToast() {
  listeners.forEach((fn) => fn(null));
}

export function onToast(fn: (msg: ToastMessage | null) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
