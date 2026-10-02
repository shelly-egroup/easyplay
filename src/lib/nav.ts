import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

// 從首頁點進遊戲的話，「回首頁」就用上一頁，安卓的返回鍵才不會繞圈圈
let cameFromHome = false;

export function markFromHome() {
  cameFromHome = true;
}

export function useGoHome() {
  const router = useRouter();
  return useCallback(() => {
    if (cameFromHome) {
      cameFromHome = false;
      router.back();
    } else {
      router.replace('/', { transitionTypes: ['nav-back'] });
    }
  }, [router]);
}
