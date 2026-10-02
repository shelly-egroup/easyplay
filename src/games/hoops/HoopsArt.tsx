import BallSvg from './BallSvg';
import s from './hoops.module.css';

// 說明示範：點一下，球往上飛進籃框
export default function HoopsArt() {
  return (
    <div className={s.demo}>
      <span className={s.dboard} />
      <span className={s.dball}>
        <BallSvg />
      </span>
      <span className={s.drim} />
      <span className={s.dnet} />
      <span className={`demo-hand ${s.demoHand}`} aria-hidden="true">
        👆
      </span>
    </div>
  );
}
