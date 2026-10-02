'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import GameShell from '@/components/GameShell';
import { ClockIcon } from '@/components/icons';
import { IntroSheet, Meter, Sheet, WinSheet } from '@/components/ui';
import { GAME } from '@/games/registry';
import { burst, floatText } from '@/lib/fx';
import { fitGrid, pick, useElementSize, usePageVisible, useTimers } from '@/lib/hooks';
import { useGoHome } from '@/lib/nav';
import { buzz, sound } from '@/lib/sound';
import { useRunScore, type Banked } from '@/lib/score';
import { saveLevel, useSavedLevel } from '@/lib/store';
import { toast } from '@/lib/toast';
import MoleArt from './MoleArt';
import MoleSvg, { BunnySvg } from './MoleSvg';
import s from './mole.module.css';

/* 想調難度改這裡：
   holes 洞數、up 停留毫秒、gap 出現間隔、max 同時最多幾隻、goal 要打到幾分、time 限時秒數、
   bunny 出現小白兔（不能打）的機率、gold 出現金色地鼠（加 2 分）的機率 */
type MoleLevel = { holes: number; up: number; gap: number; max: number; goal: number; time: number; bunny: number; gold: number };
const LEVELS: MoleLevel[] = [
  { holes: 3, up: 2600, gap: 1100, max: 1, goal: 8, time: 40, bunny: 0, gold: 0 },
  { holes: 4, up: 2300, gap: 1000, max: 1, goal: 10, time: 40, bunny: 0, gold: 0.12 },
  { holes: 6, up: 2000, gap: 900, max: 2, goal: 12, time: 40, bunny: 0, gold: 0.12 },
  { holes: 6, up: 1800, gap: 850, max: 2, goal: 14, time: 40, bunny: 0.18, gold: 0.12 },
  { holes: 9, up: 1700, gap: 800, max: 2, goal: 16, time: 40, bunny: 0.2, gold: 0.12 },
  { holes: 9, up: 1500, gap: 750, max: 3, goal: 18, time: 40, bunny: 0.25, gold: 0.12 },
];
function levelConfig(n: number): MoleLevel {
  if (n <= LEVELS.length) return LEVELS[n - 1];
  const extra = n - LEVELS.length;
  const last = LEVELS[LEVELS.length - 1];
  return { ...last, up: Math.max(1100, last.up - extra * 70), gap: Math.max(600, last.gap - extra * 25), goal: Math.min(26, last.goal + extra * 2), bunny: 0.28 };
}

// 分數（會一關一關累積）：地鼠 5×關卡、金色 10×關卡、打到兔子扣 5×關卡；過關時剩幾秒再加幾秒×關卡
const MOLE_POINTS = 5;

type Kind = 'mole' | 'gold' | 'bunny';
type Hole = { state: 'idle' | 'up' | 'hit'; kind: Kind };
type Phase = 'intro' | 'ready' | 'play' | 'timeout' | 'win';

const idle = (n: number): Hole[] => Array.from({ length: n }, () => ({ state: 'idle', kind: 'mole' }));

export default function MoleGame() {
  const saved = useSavedLevel('mole');
  const goHome = useGoHome();
  const timers = useTimers();
  const visible = usePageVisible();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();

  const [phase, setPhase] = useState<Phase>('intro');
  const [level, setLevel] = useState(1);
  const [holes, setHoles] = useState<Hole[]>(() => idle(3));
  const [score, setScore] = useState(0);
  const [count, setCount] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const run = useRunScore('mole');
  const [banked, setBanked] = useState<Banked | null>(null);

  const holesRef = useRef<Hole[]>([]);
  const downTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>([]);
  const levelRef = useRef(1);
  const phaseRef = useRef<Phase>('intro');
  const scoreRef = useRef(0);
  const lastHole = useRef(-1);
  const warnedBunny = useRef(false);
  const holeEls = useRef(new Map<number, HTMLButtonElement>());
  const remaining = useRef(0);

  const shownLevel = phase === 'intro' ? (saved ?? 1) : level;
  const cfg = levelConfig(shownLevel);
  const gap = stage.width < 520 ? 10 : 22;
  const pad = stage.width < 520 ? 14 : 28;
  const fit = fitGrid(cfg.holes, stage.width - pad * 2, stage.height - pad * 2, gap, { ratio: 1.15, minRatio: 0.95, maxRatio: 1.4 });

  const goPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const setHole = useCallback((i: number, h: Hole) => {
    const next = holesRef.current.slice();
    next[i] = h;
    holesRef.current = next;
    setHoles(next);
  }, []);
  const lower = useCallback(
    (i: number) => {
      timers.cancel(downTimers.current[i]);
      downTimers.current[i] = null;
      const h = holesRef.current[i];
      if (h && h.state !== 'idle') setHole(i, { ...h, state: 'idle' });
    },
    [timers, setHole]
  );

  // 每關開始：3、2、1、開始！
  const start = (n: number) => {
    timers.clear();
    const c = levelConfig(n);
    levelRef.current = n;
    run.begin(n);
    setBanked(null);
    setLevel(n);
    saveLevel('mole', n);
    holesRef.current = idle(c.holes);
    setHoles(holesRef.current);
    downTimers.current = Array(c.holes).fill(null);
    scoreRef.current = 0;
    setScore(0);
    lastHole.current = -1;
    remaining.current = c.time * 1000;
    setTimeLeft(c.time);
    goPhase('ready');
    [3, 2, 1, 0].forEach((k, i) =>
      timers.after(i * 750, () => {
        setCount(k);
        sound.count(k === 0);
      })
    );
    timers.after(3 * 750 + 500, () => goPhase('play'));
  };

  // 地鼠出現的節奏：遊戲進行中、畫面看得到時才跑
  useEffect(() => {
    if (phase !== 'play' || !visible) return;
    let alive = true;
    let tickId: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (!alive) return;
      const c = levelConfig(levelRef.current);
      const st = holesRef.current;
      if (st.filter((h) => h.state !== 'idle').length < c.max) {
        const free = st.map((h, i) => (h.state === 'idle' && i !== lastHole.current ? i : -1)).filter((i) => i >= 0);
        if (free.length) {
          const i = pick(free);
          const roll = Math.random();
          const kind: Kind = roll < c.bunny ? 'bunny' : roll < c.bunny + c.gold ? 'gold' : 'mole';
          lastHole.current = i;
          setHole(i, { state: 'up', kind });
          downTimers.current[i] = timers.after(kind === 'gold' ? c.up * 0.75 : c.up, () => lower(i));
        }
      }
      tickId = setTimeout(tick, c.gap + Math.random() * 450);
    };
    tickId = setTimeout(tick, 300);
    return () => {
      alive = false;
      if (tickId) clearTimeout(tickId);
      holesRef.current.forEach((_, i) => lower(i));
    };
  }, [phase, visible, timers, setHole, lower]);

  // 倒數計時：時間到還沒達標就再試一次
  useEffect(() => {
    if (phase !== 'play' || !visible) return;
    const deadline = performance.now() + remaining.current;
    const id = setInterval(() => {
      remaining.current = Math.max(0, deadline - performance.now());
      setTimeLeft(Math.ceil(remaining.current / 1000));
      if (remaining.current <= 0) {
        clearInterval(id);
        sound.nope();
        goPhase('timeout');
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase, visible]);

  const whack = (i: number) => {
    sound.unlock();
    const h = holesRef.current[i];
    if (phaseRef.current !== 'play' || !h || h.state !== 'up') return;
    timers.cancel(downTimers.current[i]);
    setHole(i, { ...h, state: 'hit' });
    const r = holeEls.current.get(i)?.getBoundingClientRect();
    const cx = r ? r.left + r.width / 2 : 0;
    const cy = r ? r.top + r.height * 0.36 : 0;
    let gain = 1;
    if (h.kind === 'bunny') {
      gain = scoreRef.current > 0 ? -1 : 0;
      sound.nope();
      buzz([20, 40, 20]);
      if (r) floatText(cx, r.top + r.height * 0.15, `-${MOLE_POINTS * levelRef.current}`, '#C2392D');
      run.add(-MOLE_POINTS * levelRef.current);
      if (!warnedBunny.current) {
        warnedBunny.current = true;
        toast(
          <>
            <b>小白兔</b> 不能打喔，只打地鼠！
          </>,
          3600
        );
      }
    } else {
      gain = h.kind === 'gold' ? 2 : 1;
      if (h.kind === 'gold') sound.good();
      else sound.bonk();
      buzz(22);
      if (r) {
        burst(cx, cy, h.kind === 'gold' ? '#FFC531' : '#FFB52E', h.kind === 'gold' ? 16 : 10, r.width * 0.5);
        floatText(cx, r.top + r.height * 0.15, `+${gain * MOLE_POINTS * levelRef.current}`, h.kind === 'gold' ? '#D18A00' : '#9A5D00');
      }
      run.add(gain * MOLE_POINTS * levelRef.current);
    }
    scoreRef.current = Math.max(0, scoreRef.current + gain);
    setScore(scoreRef.current);
    downTimers.current[i] = timers.after(650, () => lower(i));
    if (scoreRef.current >= levelConfig(levelRef.current).goal) {
      phaseRef.current = 'win';
      run.add(Math.ceil(remaining.current / 1000) * levelRef.current);
      timers.after(900, () => {
        setBanked(run.bank());
        saveLevel('mole', levelRef.current + 1);
        goPhase('win');
      });
    }
  };

  const nextCfg = levelConfig(level + 1);
  const curCfg = levelConfig(level);
  const note =
    nextCfg.bunny > 0 && curCfg.bunny === 0
      ? '下一關會出現不能打的小白兔！'
      : nextCfg.gold > 0 && curCfg.gold === 0
        ? '下一關有金色地鼠，打到加 2 分'
        : nextCfg.holes > curCfg.holes
          ? `下一關有 ${nextCfg.holes} 個洞`
          : '下一關地鼠會更快喔';
  const shownHoles = phase === 'intro' ? idle(cfg.holes) : holes;
  const shownTime = phase === 'intro' ? cfg.time : timeLeft;

  return (
    <GameShell
      game={GAME.mole}
      level={shownLevel}
      stageRef={stageRef}
      hud={
        <div className={s.hud}>
          <Meter value={Math.min(score, cfg.goal)} max={cfg.goal}>
            目標 <b key={score}>{Math.min(score, cfg.goal)}</b>
            <span>/ {cfg.goal}</span>
          </Meter>
          <span className="hud-card total-card">
            總分 <b key={run.total}>{run.total.toLocaleString()}</b>
          </span>
          <span className={shownTime <= 10 && phase === 'play' ? `hud-card ${s.clock} ${s.clockLow}` : `hud-card ${s.clock}`}>
            <ClockIcon />
            <b>{shownTime}</b>秒
          </span>
        </div>
      }
    >
      <div className={s.field} style={{ padding: pad, visibility: stage.width ? 'visible' : 'hidden' }}>
        <div className={s.grid} style={{ '--cols': fit.cols, '--w': `${fit.w}px`, '--h': `${fit.h}px`, '--gap': `${gap}px` } as CSSProperties}>
          {shownHoles.map((h, i) => (
            <button
              key={`${level}-${i}`}
              ref={(el) => {
                if (el) holeEls.current.set(i, el);
                else holeEls.current.delete(i);
              }}
              type="button"
              className={[s.hole, h.state === 'up' && s.isUp, h.state === 'hit' && s.isHit, h.kind === 'bunny' && s.isBunny].filter(Boolean).join(' ')}
              onPointerDown={(e) => {
                if (e.isPrimary && e.button <= 0) whack(i);
              }}
              aria-label={h.state === 'up' ? (h.kind === 'bunny' ? '小白兔，不要打' : '地鼠出來了，點一下') : '地鼠洞'}
            >
              <span className={s.back} />
              <span className={s.clip}>
                <span className={s.mole}>{h.kind === 'bunny' ? <BunnySvg /> : <MoleSvg gold={h.kind === 'gold'} />}</span>
              </span>
              <span className={s.front} />
              <span className={s.stars} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
          ))}
        </div>
        {phase === 'ready' && (
          <div className={s.ready} key={count} aria-live="assertive">
            {count > 0 ? count : '開始！'}
          </div>
        )}
      </div>

      <IntroSheet
        open={phase === 'intro'}
        title={GAME.mole.title}
        art={<MoleArt />}
        text={
          <>
            地鼠探出頭來，趕快 <b>點一下</b> 牠！
            <br />
            時間內達到目標 {cfg.goal} 就過關。
            {cfg.bunny > 0 && (
              <>
                <br />
                小白兔 <b>不能打</b> 喔！
              </>
            )}
          </>
        }
        say="地鼠會從洞裡探出頭來，看到了就點一下牠。在時間內打到目標分數就過關。金色地鼠加兩分，小白兔不能打喔。"
        level={saved ?? 1}
        onStart={start}
      />
      <Sheet open={phase === 'timeout'} label="時間到了">
        <div className="sheet__hero" aria-hidden="true">
          <div className={s.timeoutArt}>
            <MoleSvg />
          </div>
        </div>
        <div className="sheet__body">
          <h2 className="sheet__title">時間到了！</h2>
          <p className="sheet__text">
            這一關打到 <b>{score}</b>，還差 <b>{Math.max(0, cfg.goal - score)}</b> 就過關了。
            <br />
            再試一次，一定可以！
          </p>
          <div className="sheet__actions">
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => {
                sound.tap();
                start(level);
              }}
            >
              再試一次
            </button>
            <button className="btn btn--ghost" type="button" onClick={goHome}>
              休息一下，回首頁
            </button>
            <button className="btn btn--quiet" type="button" onClick={() => start(1)}>
              從第 1 關重新開始
            </button>
          </div>
        </div>
      </Sheet>
      <WinSheet open={phase === 'win'} level={level} points={banked} note={note} onNext={() => start(level + 1)} onRestart={() => start(1)} onHome={goHome} />
    </GameShell>
  );
}
