import type { NextConfig } from 'next';

// 輸出成純靜態網站（out/），放到 Vercel、GitHub Pages 都可以
// 若網址在子路徑（例如 GitHub Pages 的 /easyplay），建置時設定 NEXT_PUBLIC_BASE_PATH=/easyplay
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
