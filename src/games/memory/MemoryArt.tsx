import s from './memory.module.css';

// 說明示範：翻開兩張一樣的蘋果，配對成功
const DEMO = ['🍎', '🍌', '🍎'];

export default function MemoryArt() {
  return (
    <div className={s.demo}>
      {DEMO.map((e, i) => (
        <span key={i} className={`${s.dcard} ${s[`d${i}`]}`}>
          <span className={s.dinner}>
            <span className={`${s.face} ${s.back}`}>
              <span className={s.backMark}>?</span>
            </span>
            <span className={`${s.face} ${s.front}`}>
              <span className={s.demoji}>{e}</span>
            </span>
          </span>
        </span>
      ))}
      <span className={`demo-hand ${s.demoHand}`} aria-hidden="true">
        👆
      </span>
    </div>
  );
}
