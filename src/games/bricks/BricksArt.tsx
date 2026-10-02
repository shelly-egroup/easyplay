import { TileFace } from '@/components/TileFace';
import s from './bricks.module.css';

// 說明示範：最下面那排缺一格，點一下補上去，整排消掉
export default function BricksArt({ still }: { still?: boolean }) {
  return (
    <div className={still ? `${s.demo} ${s.still}` : s.demo}>
      <div className={`${s.drow} ${s.dtop}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i}>
            <TileFace color={4} />
          </span>
        ))}
      </div>
      <div className={`${s.drow} ${s.dbottom}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i}>{i === 2 ? <span className={s.dgap} /> : <TileFace color={1} />}</span>
        ))}
      </div>
      <span className={s.dshot}>
        <TileFace color={1} />
      </span>
      {!still && (
        <span className={`demo-hand ${s.demoHand}`} aria-hidden="true">
          👆
        </span>
      )}
    </div>
  );
}
