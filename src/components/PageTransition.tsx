import { ViewTransition, type ReactNode } from 'react';

// 進遊戲往前推、回首頁往後退；瀏覽器返回鍵沒有方向資訊，就當成「回去」
const MOTION = { 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'nav-back' };

export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={MOTION} exit={MOTION} default="none">
      {children}
    </ViewTransition>
  );
}
