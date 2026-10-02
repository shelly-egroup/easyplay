import type { CSSProperties } from 'react';
import { CANDY } from '@/lib/palette';
import s from './numbers.module.css';

// 說明示範：泡泡飄來飄去，先點破 1
const DEMO = [
  { n: 2, cls: 'd2', color: 1 },
  { n: 1, cls: 'd1', color: 0 },
  { n: 3, cls: 'd3', color: 3 },
];

export default function NumbersArt() {
  return (
    <div className={s.demo}>
      {DEMO.map((d) => (
        <span
          key={d.n}
          className={`${s.dball} ${s[d.cls]}`}
          style={{ '--c': CANDY[d.color].base, '--c-hi': CANDY[d.color].hi, '--c-lo': CANDY[d.color].lo } as CSSProperties}
        >
          {d.n}
        </span>
      ))}
      <span className={`demo-hand ${s.demoHand}`} aria-hidden="true">
        👆
      </span>
    </div>
  );
}
