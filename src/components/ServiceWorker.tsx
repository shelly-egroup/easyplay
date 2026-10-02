'use client';

import { useEffect } from 'react';

// 正式版才註冊 service worker：可以加到主畫面、沒網路也能玩
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      // 註冊失敗只是不能離線玩，遊戲照常
    });
  }, []);
  return null;
}
