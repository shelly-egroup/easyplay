import MoleSvg from './MoleSvg';
import s from './mole.module.css';

export default function MoleArt() {
  return (
    <div className={s.demo}>
      <span className={s.demoBack} />
      <span className={s.demoClip}>
        <MoleSvg className={s.demoMole} />
      </span>
      <span className={s.demoFront} />
      <span className={`demo-hand ${s.demoHand}`} aria-hidden="true">
        👆
      </span>
    </div>
  );
}
