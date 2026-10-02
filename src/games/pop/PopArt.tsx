import type { CSSProperties } from 'react';
import { TileFace } from '@/components/TileFace';
import s from './pop.module.css';

// 3×3 示範：紅色那一串被點一下就消掉
const MAP = ['001', '101', '101'];

export default function PopArt() {
  return (
    <div className="demo-tray">
      <div className={s.demo}>
        {MAP.flatMap((row, r) =>
          row.split('').map((k, c) => (
            <span key={`${r}${c}`} className={k === '0' ? `${s.demoCell} ${s.demoGroup}` : s.demoCell} style={{ '--x': c, '--y': r } as CSSProperties}>
              <TileFace color={Number(k)} />
            </span>
          ))
        )}
        <span className={`demo-hand ${s.demoHand}`} aria-hidden="true">
          👆
        </span>
      </div>
    </div>
  );
}
