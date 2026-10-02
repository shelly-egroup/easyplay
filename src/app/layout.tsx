import type { Metadata, Viewport } from 'next';
import { Noto_Sans_TC, Outfit } from 'next/font/google';
import ServiceWorker from '@/components/ServiceWorker';
import Toaster from '@/components/Toaster';
import './globals.css';

// 思源黑體（台灣字形）：筆畫清楚、粗體穩重；Outfit：乾淨好認的數字
const noto = Noto_Sans_TC({ weight: ['500', '700', '900'], subsets: ['latin'], variable: '--font-noto', display: 'swap' });
const outfit = Outfit({ weight: ['600', '700', '800'], subsets: ['latin'], variable: '--font-outfit', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'easyplay 小遊戲', template: '%s・easyplay' },
  description: '大字、大按鈕、滿版好按的小遊戲：消消樂、翻牌配對、數字點點、打地鼠、投籃、補磚塊。',
  applicationName: 'easyplay',
  appleWebApp: { capable: true, title: 'easyplay', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f4ee',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-Hant-TW" className={`${noto.variable} ${outfit.variable}`}>
      <body>
        {children}
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
