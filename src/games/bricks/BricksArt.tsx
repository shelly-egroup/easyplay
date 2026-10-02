import type { CSSProperties } from 'react';
import { CANDY } from '@/lib/palette';
import s from './bricks.module.css';

const brick = (color: number) =>
  ({ '--c': CANDY[color].base, '--c-hi': CANDY[color].hi, '--c-lo': CANDY[color].lo }) as CSSProperties;

// 說明示範：迷你深色磚牆。最下面那排缺一格，點一下補上去，整排消掉
export default function BricksArt({ still }: { still?: boolean }) {
  return (
    <div className={still ? `${s.demo} ${s.still}` : s.demo}>
      <div className={`${s.drow} ${s.dtop}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i === 0 ? s.hole : undefined}>
            {i !== 0 && <span className={s.brick} style={brick(4)} />}
          </span>
        ))}
      </div>
      <div className={`${s.drow} ${s.dbottom}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i === 2 ? `${s.hole} ${s.need}` : undefined}>
            {i !== 2 && <span className={s.brick} style={brick(1)} />}
          </span>
        ))}
      </div>
      <span className={s.dshot}>
        <span className={s.brick} style={{ ...brick(1), fontSize: '0.62em' }} />
      </span>
      <span className={s.dpad} />
      {!still && (
        <span className={`demo-hand ${s.demoHand}`} aria-hidden="true">
          👆
        </span>
      )}
    </div>
  );
}
