'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import GameShell from '@/components/GameShell';
import { ClockIcon } from '@/components/icons';
import { IntroSheet, Sheet, usePraise } from '@/components/ui';
import { GAME } from '@/games/registry';
import { burst, floatText, prefersReducedMotion } from '@/lib/fx';
import { useElementSize, usePageVisible, useTimers } from '@/lib/hooks';
import { useGoHome } from '@/lib/nav';
import { buzz, sound } from '@/lib/sound';
import { read, write } from '@/lib/store';
import BallSvg from './BallSvg';
import HoopsArt from './HoopsArt';
import s from './hoops.module.css';

// 投籃（不分關卡，比分數）：
// 點一下，球就往上飛；投進就重新計時，只要一直投進就能一直玩下去，時間到才結束。
// 連進 3 球變火焰球（分數 ×2），連進 6 球變藍火（×3）。投越多籃框動得越快，後來還會上下移動。

/** 投進幾球之後，籃框怎麼動（左右幅度、速度；上下幅度、速度；都是畫面比例） */
const TIERS = [
  { at: 0, ax: 0, wx: 0, ay: 0, wy: 0, clock: 10 },
  { at: 3, ax: 0.16, wx: 0.9, ay: 0, wy: 0, clock: 10 },
  { at: 8, ax: 0.24, wx: 1.3, ay: 0, wy: 0, clock: 10 },
  { at: 14, ax: 0.27, wx: 1.5, ay: 0.06, wy: 1.1, clock: 8 },
  { at: 21, ax: 0.3, wx: 1.85, ay: 0.08, wy: 1.5, clock: 7 },
  { at: 30, ax: 0.32, wx: 2.1, ay: 0.1, wy: 1.8, clock: 7 },
  { at: 40, ax: 0.34, wx: 2.4, ay: 0.11, wy: 2.1, clock: 6 },
];
const tierFor = (makes: number) => [...TIERS].reverse().find((t) => makes >= t.at)!;
const multFor = (streak: number) => (streak >= 6 ? 3 : streak >= 3 ? 2 : 1);
const MAX_IN_AIR = 3;

type Ball = { id: number; x: number; y: number; vx: number; vy: number; scale: number; flying: boolean; crossed: boolean; fire: number };
type Phase = 'intro' | 'play' | 'over';

export default function HoopsGame() {
  const goHome = useGoHome();
  const timers = useTimers();
  const praise = usePraise();
  const visible = usePageVisible();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const size = useRef({ w: 0, h: 0 });
  useEffect(() => {
    size.current = { w: stage.width, h: stage.height };
  }, [stage]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [seconds, setSeconds] = useState(10);
  const [best, setBest] = useState(0);
  const [record, setRecord] = useState(false);
  const [balls, setBalls] = useState<{ id: number; fire: number; flying: boolean }[]>([]);

  const phaseRef = useRef<Phase>('intro');
  const ballsRef = useRef<Ball[]>([]);
  const ballEls = useRef(new Map<number, HTMLDivElement>());
  const hoopEl = useRef<HTMLDivElement>(null);
  const frontEl = useRef<HTMLDivElement>(null);
  const netEl = useRef<HTMLDivElement>(null);
  const clockEl = useRef<HTMLElement>(null);
  const nextId = useRef(1);
  const game = useRef({ score: 0, streak: 0, makes: 0, time: 10, hx: 0, hy: 0, px: 0, py: 0, ax: 0, ay: 0 });

  useEffect(() => {
    const id = setTimeout(() => setBest(read('hoops.best', 0)), 0);
    return () => clearTimeout(id);
  }, []);

  /** 依畫面大小算出籃框、球的尺寸與投籃力道 */
  const geometry = () => {
    const { w, h } = size.current;
    const rim = Math.max(150, Math.min(270, w * 0.24, h * 0.36));
    const r = rim * 0.3;
    const rimY = Math.max(rim * 0.95 + 24, h * 0.3);
    const startY = h - r - 26;
    const apexY = rimY - rim * 0.6;
    const t = 0.62;
    const g = (2 * (startY - apexY)) / (t * t);
    return { w, h, rim, r, rimY, startY, g, v0: g * t };
  };

  const syncBalls = () => setBalls(ballsRef.current.map((b) => ({ id: b.id, fire: b.fire, flying: b.flying })));

  const rack = () => {
    const geo = geometry();
    if (ballsRef.current.some((b) => !b.flying)) return;
    ballsRef.current.push({ id: nextId.current++, x: geo.w / 2, y: geo.startY, vx: 0, vy: 0, scale: 1, flying: false, crossed: false, fire: 0 });
    syncBalls();
  };

  const start = () => {
    timers.clear();
    const geo = geometry();
    game.current = { score: 0, streak: 0, makes: 0, time: 10, hx: geo.w / 2, hy: geo.rimY, px: 0, py: 0, ax: 0, ay: 0 };
    ballsRef.current = [];
    setScore(0);
    setStreak(0);
    setSeconds(10);
    setRecord(false);
    phaseRef.current = 'play';
    setPhase('play');
    rack();
  };

  const end = () => {
    phaseRef.current = 'over';
    setPhase('over');
    sound.nope();
    const prev = read('hoops.best', 0);
    if (game.current.score > prev) {
      write('hoops.best', game.current.score);
      setBest(game.current.score);
      setRecord(true);
      timers.after(300, () => sound.win());
    }
  };

  const shoot = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button > 0 || phaseRef.current !== 'play') return;
    sound.unlock();
    const ready = ballsRef.current.find((b) => !b.flying);
    if (!ready || ballsRef.current.filter((b) => b.flying).length >= MAX_IN_AIR) return;
    const geo = geometry();
    ready.flying = true;
    ready.vy = -geo.v0;
    ready.fire = multFor(game.current.streak) - 1;
    sound.tap();
    buzz(10);
    syncBalls();
    timers.after(220, rack);
  };

  // 主迴圈：移動籃框、球的拋物線、判斷進球、倒數計時
  useEffect(() => {
    if (phase !== 'play' || !visible) return;
    const reduce = prefersReducedMotion();
    let raf = 0;
    let last = performance.now();
    let shownSec = -1;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const geo = geometry();
      const st = game.current;
      const tier = tierFor(st.makes);

      // 籃框：幅度慢慢變大，不會突然跳
      st.ax += (tier.ax * geo.w - st.ax) * Math.min(1, dt * 1.5);
      st.ay += (tier.ay * geo.h - st.ay) * Math.min(1, dt * 1.5);
      if (!reduce) {
        st.px += tier.wx * dt;
        st.py += tier.wy * dt;
      }
      st.hx = geo.w / 2 + Math.sin(st.px) * Math.min(st.ax, geo.w / 2 - geo.rim * 0.8);
      st.hy = Math.max(geo.rim * 0.95 + 24, geo.rimY + Math.sin(st.py) * st.ay);
      const hoopT = `translate3d(${st.hx}px,${st.hy}px,0)`;
      if (hoopEl.current) hoopEl.current.style.transform = hoopT;
      if (frontEl.current) frontEl.current.style.transform = hoopT;

      // 球
      let changed = false;
      for (const b of ballsRef.current) {
        if (!b.flying) {
          b.x = geo.w / 2;
          b.y = geo.startY;
          continue;
        }
        const prevY = b.y;
        b.vy += geo.g * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const rise = Math.min(1, Math.max(0, (geo.startY - b.y) / (geo.startY - st.hy)));
        if (b.vy < 0) b.scale = 1 - 0.3 * rise;
        if (!b.crossed && b.vy > 0 && prevY < st.hy && b.y >= st.hy) {
          b.crossed = true;
          const dx = Math.abs(b.x - st.hx);
          const rEff = geo.r * b.scale;
          if (dx < geo.rim / 2 - rEff * 0.5) made();
          else if (dx < geo.rim / 2 + rEff * 0.85) {
            b.vy = -Math.abs(b.vy) * 0.38;
            b.vx = (b.x >= st.hx ? 1 : -1) * 260;
            missed(true);
          } else missed(false);
        }
        const el = ballEls.current.get(b.id);
        if (el) {
          el.style.transform = `translate3d(${b.x - geo.r}px,${b.y - geo.r}px,0) scale(${b.scale})`;
          el.style.zIndex = b.vy > 0 && b.y < st.hy + geo.r * 2 ? '2' : '5';
        }
        if (b.y > geo.h + geo.r * 3) changed = true;
      }
      for (const b of ballsRef.current) {
        if (!b.flying) {
          const el = ballEls.current.get(b.id);
          if (el) el.style.transform = `translate3d(${b.x - geo.r}px,${b.y - geo.r}px,0)`;
        }
      }
      if (changed) {
        ballsRef.current = ballsRef.current.filter((b) => b.y <= geo.h + geo.r * 3);
        syncBalls();
      }

      // 倒數計時
      st.time = Math.max(0, st.time - dt);
      if (clockEl.current) clockEl.current.style.width = `${(st.time / tier.clock) * 100}%`;
      const sec = Math.ceil(st.time);
      if (sec !== shownSec) {
        shownSec = sec;
        setSeconds(sec);
      }
      if (st.time <= 0) {
        end();
        return;
      }
      raf = requestAnimationFrame(step);
    };

    const made = () => {
      const st = game.current;
      const mult = multFor(st.streak);
      const gained = 2 * mult;
      st.streak += 1;
      st.makes += 1;
      st.score += gained;
      st.time = tierFor(st.makes).clock;
      setScore(st.score);
      setStreak(st.streak);
      sound.swish(mult);
      buzz(mult > 1 ? [20, 30, 20] : 18);
      netEl.current?.animate?.([{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.28) scaleX(0.9)' }, { transform: 'scaleY(1)' }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' });
      const rect = hoopEl.current?.getBoundingClientRect();
      if (rect) {
        burst(rect.left, rect.top, mult > 2 ? '#7EC8FF' : mult > 1 ? '#FF8A3D' : '#FFC43D', mult > 1 ? 16 : 10, 90);
        floatText(rect.left, rect.top - 30, `+${gained}`, mult > 2 ? '#2C77D8' : '#C2410C');
      }
      if (st.streak === 3) praise.show('火焰球！');
      else if (st.streak === 6) praise.show('超級火焰！');
      else if (st.makes === TIERS[3].at) praise.show('籃框會上下動囉！');
    };
    const missed = (rim: boolean) => {
      const st = game.current;
      if (rim) sound.clank();
      if (st.streak >= 3) praise.show('火焰熄滅了');
      st.streak = 0;
      setStreak(0);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 迴圈只依遊戲狀態重啟
  }, [phase, visible]);

  const rimSize = Math.max(150, Math.min(270, stage.width * 0.24, stage.height * 0.36));
  const ballSize = rimSize * 0.6;
  const fireNow = multFor(streak) - 1;

  return (
    <GameShell
      game={GAME.hoops}
      badge={`最高 ${best} 分`}
      stageRef={stageRef}
      hud={
        <div className={s.hud}>
          <span className={`hud-card ${s.score}`}>
            分數 <b key={score}>{score}</b>
            {fireNow > 0 && <span className={fireNow > 1 ? `${s.combo} ${s.comboBlue}` : s.combo}>🔥 ×{fireNow + 1}</span>}
          </span>
          <span className={seconds <= 3 && phase === 'play' ? `hud-card ${s.clock} ${s.clockLow}` : `hud-card ${s.clock}`}>
            <ClockIcon />
            <span className={s.clockTrack}>
              <i ref={clockEl} />
            </span>
            <b>{phase === 'intro' ? 10 : seconds}</b>
          </span>
        </div>
      }
    >
      <div
        className={s.court}
        style={{ '--rim': `${rimSize}px`, '--ball': `${ballSize}px`, visibility: stage.width ? 'visible' : 'hidden' } as CSSProperties}
        onPointerDown={shoot}
      >
        <div className={s.floor} />
        <div className={s.hoop} ref={hoopEl}>
          <div className={s.board}>
            <span className={s.square} />
          </div>
          <span className={s.rimBack} />
        </div>
        {balls.map((b) => {
          const fire = b.flying ? b.fire : fireNow;
          return (
          <div
            key={b.id}
            ref={(el) => {
              if (el) ballEls.current.set(b.id, el);
              else ballEls.current.delete(b.id);
            }}
            className={[s.ball, !b.flying && s.ready, fire > 0 && s.fire, fire > 1 && s.fireBlue].filter(Boolean).join(' ')}
          >
            <span className={s.flame} />
            <BallSvg className={s.ballSvg} />
          </div>
          );
        })}
        <div className={s.hoopFront} ref={frontEl}>
          <span className={s.rimFront} />
          <div className={s.net} ref={netEl} />
        </div>
        {phase === 'play' && score === 0 && <div className={s.tapHint}>點一下就投籃 👆</div>}
      </div>
      {praise.node}

      <IntroSheet
        open={phase === 'intro'}
        title={GAME.hoops.title}
        art={<HoopsArt />}
        text={
          <>
            點一下，球就往上飛！<b>連續投進</b> 變火焰球，分數加倍。
            <br />
            投進會重新計時，時間到就結束。
          </>
        }
        say="點一下畫面，球就會往上飛。連續投進三球會變成火焰球，分數加倍。每投進一球，時間就重新計算，時間到就結束。"
        tag={best > 0 ? `最高 ${best} 分` : undefined}
        onStart={start}
      />
      <Sheet open={phase === 'over'} label="時間到了" confetti={record}>
        <div className="sheet__hero" aria-hidden="true">
          <div className={s.overBall}>
            <BallSvg />
          </div>
        </div>
        <div className="sheet__body">
          <p className="win__kicker">{record ? '新紀錄！' : '時間到了'}</p>
          <h2 className="sheet__title">{score} 分</h2>
          <p className="sheet__text">{record ? '打破最高紀錄，太厲害了！' : `最高紀錄是 ${best} 分，再接再厲！`}</p>
          <div className="sheet__actions">
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => {
                sound.tap();
                start();
              }}
            >
              再玩一次
            </button>
            <button className="btn btn--ghost" type="button" onClick={goHome}>
              休息一下，回首頁
            </button>
          </div>
        </div>
      </Sheet>
    </GameShell>
  );
}
