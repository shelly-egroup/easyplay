import type { CSSProperties } from 'react';
import { CANDY } from '@/lib/palette';

// 糖果方塊：只有顏色，沒有圖案；光澤和厚度讓它看起來像一顆一顆的軟糖
export function TileFace({ color, className }: { color: number; className?: string }) {
  const c = CANDY[color];
  return (
    <span
      className={className ? `tface ${className}` : 'tface'}
      style={{ '--c': c.base, '--c-hi': c.hi, '--c-lo': c.lo } as CSSProperties}
    />
  );
}
