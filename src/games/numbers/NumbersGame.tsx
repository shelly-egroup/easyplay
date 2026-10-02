'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import GameShell from '@/components/GameShell';
import { CheckIcon, ClockIcon } from '@/components/icons';
import { IntroSheet, Sheet, WinSheet } from '@/components/ui';
import { GAME } from '@/games/registry';
import { burst, prefersReducedMotion, shake } from '@/lib/fx';
import { pick, shuffle, useElementSize, usePageVisible, useTimers } from '@/lib/hooks';
import { useGoHome } from '@/lib/nav';
import { CANDY } from '@/lib/palette';
import { buzz, sound } from '@/lib/sound';
import { saveLevel, useSavedLevel } from '@/lib/store';
import { toast } from '@/lib/toast';
import NumbersArt from './NumbersArt';
import s from './numbers.module.css';

// 數字點點（練專注力）：照 1、2、3⋯ 的順序點破數字泡泡。
// 前幾關泡泡慢慢飄；第 4 關起有時間限制；第 5 關起穿插「輪盤」——數字排在轉動的圓圈上。

type Mode = 'float' | 'wheel';
type NumLevel = { mode: Mode; count: number; speed?: number; rings?: number[]; spin?: number; time?: number };

/* 想調難度改這裡：
   float：count 幾顆、speed 每秒飄幾像素；wheel：rings 每一圈幾顆（外到內）、spin 每秒轉幾度；time 限時幾秒（沒寫就不限時） */
const LEVELS: NumLevel[] = [
  { mode: 'float', count: 5, speed: 34 },
  { mode: 'float', count: 7, speed: 42 },
  { mode: 'float', count: 9, speed: 50 },
  { mode: 'float', count: 9, speed: 52, time: 45 },
  { mode: 'wheel', count: 8, rings: [8], spin: 14, time: 45 },
  { mode: 'float', count: 12, speed: 58, time: 50 },
  { mode: 'wheel', count: 13, rings: [8, 5], spin: 16, time: 60 },
  { mode: 'float', count: 15, speed: 66, time: 55 },
  { mode: 'wheel', count: 16, rings: [10, 6], spin: 20, time: 60 },
];
function levelConfig(n: number): NumLevel {
  if (n <= LEVELS.length) return LEVELS[n - 1];
  const extra = n - LEVELS.length;
  return extra % 2 === 1
    ? { mode: 'float', count: 18, speed: Math.min(100, 70 + extra * 3), time: 55 }
    : { mode: 'wheel', count: 17, rings: [10, 7], spin: Math.min(40, 22 + extra * 2), time: 60 };
}

type Bubble = { n: number; color: number; popped: boolean };
type Body = { x: number; y: number; vx: number; vy: number; ring: number; slot: number };
type Phase = 'intro' | 'play' | 'timeout' | 'win';

// 黃色泡泡用深色字，其他用白字，都看得清楚
const INK = ['#fff', '#fff', '#3b2405', '#fff', '#fff'];

function floatRadius(count: number, W: number, H: number) {
  return Math.round(Math.max(52, Math.min(118, Math.sqrt((0.3 * W * H) / (count * Math.PI)))));
}

/** 輪盤：算出泡泡大小和每一圈的半徑，讓同一圈的泡泡不會擠在一起 */
function wheelLayout(rings: number[], W: number, H: number) {
  const max = Math.min(W, H) / 2 - 16;
  for (let r = 110; r >= 40; r -= 2) {
    const radii = rings.map((_, k) => max - r - k * r * 2.5);
    if (radii.every((R, k) => R > r * 1.1 && (Math.PI * 2 * R) / rings[k] >= r * 2.5)) return { r, radii };
  }
  return { r: 40, radii: rings.map((_, k) => Math.max(50, max - 40 - k * 94)) };
}

export default function NumbersGame() {
  const saved = useSavedLevel('numbers');
  const goHome = useGoHome();
  const timers = useTimers();
  const visible = usePageVisible();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const area = useRef({ w: 0, h: 0 });
  useEffect(() => {
    area.current = { w: stage.width, h: stage.height };
  }, [stage]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [level, setLevel] = useState(1);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [next, setNext] = useState(1);
  const [hint, setHint] = useState(0);
  const [radius, setRadius] = useState(80);
  const [wheel, setWheel] = useState<number[] | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const nextRef = useRef(1);
  const levelRef = useRef(1);
  const phaseRef = useRef<Phase>('intro');
  const bodies = useRef(new Map<number, Body>());
  const els = useRef(new Map<number, HTMLButtonElement>());
  const discEls = useRef<(HTMLDivElement | null)[]>([]);
  const wrongs = useRef(0);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const R = useRef(80);
  const radii = useRef<number[]>([]);
  const deadline = useRef(0);
  const remaining = useRef(0);

  const goPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const armHint = useCallback(() => {
    timers.cancel(hintTimer.current);
    hintTimer.current = timers.after(7000, () => setHint(nextRef.current));
  }, [timers]);

  const start = (n: number) => {
    timers.clear();
    const cfg = levelConfig(n);
    const w = stage.width;
    const h = stage.height;
    bodies.current = new Map();
    // 每次都隨機：位置、方向、顏色、輪盤上的順序
    if (cfg.mode === 'wheel' && cfg.rings) {
      const layout = wheelLayout(cfg.rings, w, h);
      R.current = layout.r;
      radii.current = layout.radii;
      setWheel(layout.radii.map((x) => x + layout.r + 8));
      const slots = cfg.rings.flatMap((count, ring) => Array.from({ length: count }, (_, slot) => ({ ring, slot })));
      const numbers = shuffle(Array.from({ length: cfg.count }, (_, i) => i + 1));
      numbers.forEach((num, i) => bodies.current.set(num, { x: 0, y: 0, vx: 0, vy: 0, ...slots[i] }));
    } else {
      const r = floatRadius(cfg.count, w, h);
      R.current = r;
      setWheel(null);
      const placed: Body[] = [];
      for (let i = 1; i <= cfg.count; i++) {
        let x = w / 2;
        let y = h / 2;
        for (let k = 0; k < 200; k++) {
          x = r + Math.random() * Math.max(1, w - 2 * r);
          y = r + Math.random() * Math.max(1, h - 2 * r);
          if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > r * 2.15)) break;
        }
        const angle = Math.random() * Math.PI * 2;
        const speed = (cfg.speed ?? 40) * (0.8 + Math.random() * 0.4);
        const body = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ring: 0, slot: 0 };
        placed.push(body);
        bodies.current.set(i, body);
      }
    }
    setRadius(R.current);
    const colors = Array.from({ length: cfg.count }, () => pick([0, 1, 2, 3, 4]));
    setBubbles(Array.from({ length: cfg.count }, (_, i) => ({ n: i + 1, color: colors[i], popped: false })));
    levelRef.current = n;
    setLevel(n);
    saveLevel('numbers', n);
    nextRef.current = 1;
    setNext(1);
    setHint(0);
    wrongs.current = 0;
    remaining.current = (cfg.time ?? 0) * 1000;
    setTimeLeft(cfg.time ?? 0);
    goPhase('play');
    armHint();
  };

  // 泡泡移動：飄的會撞邊、互相彈開；輪盤就繞著圓心轉
  useEffect(() => {
    if (phase !== 'play') return;
    const still = prefersReducedMotion();
    const cfg = levelConfig(levelRef.current);
    let raf = 0;
    let last = performance.now();
    let spinT = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = area.current;
      const r = R.current;
      const list = [...bodies.current.entries()];
      if (cfg.mode === 'wheel' && cfg.rings) {
        if (!still) spinT += dt;
        const cx = w / 2;
        const cy = h / 2;
        const rings = cfg.rings;
        for (const [, b] of list) {
          const dir = b.ring % 2 === 0 ? 1 : -1;
          const angle = ((dir * (cfg.spin ?? 15) * spinT) / 180) * Math.PI + (b.slot / rings[b.ring]) * Math.PI * 2 - Math.PI / 2;
          b.x = cx + Math.cos(angle) * radii.current[b.ring];
          b.y = cy + Math.sin(angle) * radii.current[b.ring];
        }
        discEls.current.forEach((el, k) => {
          if (el) el.style.transform = `translate(-50%,-50%) rotate(${(k % 2 === 0 ? 1 : -1) * (cfg.spin ?? 15) * spinT}deg)`;
        });
      } else if (!still) {
        for (const [, b] of list) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < r) {
            b.x = r;
            b.vx = Math.abs(b.vx);
          }
          if (b.x > w - r) {
            b.x = w - r;
            b.vx = -Math.abs(b.vx);
          }
          if (b.y < r) {
            b.y = r;
            b.vy = Math.abs(b.vy);
          }
          if (b.y > h - r) {
            b.y = h - r;
            b.vy = -Math.abs(b.vy);
          }
        }
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i][1];
            const b = list[j][1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.01;
            const min = r * 2.04;
            if (d >= min) continue;
            const nx = dx / d;
            const ny = dy / d;
            const push = (min - d) / 2;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rel < 0) {
              a.vx += rel * nx;
              a.vy += rel * ny;
              b.vx -= rel * nx;
              b.vy -= rel * ny;
            }
          }
        }
      }
      for (const [n, b] of list) {
        const el = els.current.get(n);
        if (el) el.style.transform = `translate3d(${b.x - r}px,${b.y - r}px,0)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // 倒數計時：切到背景會暫停
  useEffect(() => {
    if (phase !== 'play' || !visible || !levelConfig(levelRef.current).time) return;
    deadline.current = performance.now() + remaining.current;
    const id = setInterval(() => {
      remaining.current = Math.max(0, deadline.current - performance.now());
      const sec = Math.ceil(remaining.current / 1000);
      setTimeLeft(sec);
      if (remaining.current <= 0) {
        clearInterval(id);
        timers.cancel(hintTimer.current);
        sound.nope();
        goPhase('timeout');
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase, visible, timers]);

  const tap = (n: number) => {
    sound.unlock();
    if (phaseRef.current !== 'play' || !bodies.current.has(n)) return;
    const el = els.current.get(n);
    if (n !== nextRef.current) {
      shake(el?.firstElementChild);
      sound.nope();
      if (++wrongs.current >= 2) {
        wrongs.current = 0;
        setHint(nextRef.current);
        toast(
          <>
            請找 <b>{nextRef.current}</b>，它正在發亮喔
          </>
        );
      }
      return;
    }
    wrongs.current = 0;
    setHint(0);
    sound.step(n);
    buzz(14);
    const rect = el?.getBoundingClientRect();
    const bubble = bubbles.find((b) => b.n === n);
    if (rect && bubble) burst(rect.left + rect.width / 2, rect.top + rect.height / 2, CANDY[bubble.color].base, 12, rect.width * 0.7);
    bodies.current.delete(n);
    setBubbles((list) => list.map((b) => (b.n === n ? { ...b, popped: true } : b)));
    nextRef.current = n + 1;
    setNext(n + 1);
    if (n === levelConfig(levelRef.current).count) {
      timers.cancel(hintTimer.current);
      phaseRef.current = 'win';
      timers.after(800, () => {
        saveLevel('numbers', levelRef.current + 1);
        goPhase('win');
      });
    } else {
      armHint();
    }
  };

  const shownLevel = phase === 'intro' ? (saved ?? 1) : level;
  const shownCfg = levelConfig(shownLevel);
  const total = shownCfg.count;
  const done = phase === 'intro' ? 0 : next - 1;
  const finished = phase !== 'intro' && done >= total;
  const timed = !!shownCfg.time;
  const shownTime = phase === 'intro' ? (shownCfg.time ?? 0) : timeLeft;
  const nextCfg = levelConfig(level + 1);

  const note =
    nextCfg.mode === 'wheel' && levelConfig(level).mode !== 'wheel'
      ? '下一關是會轉的輪盤！'
      : nextCfg.time && !levelConfig(level).time
        ? '下一關開始有時間限制'
        : `下一關有 ${nextCfg.count} 個數字`;

  return (
    <GameShell
      game={GAME.numbers}
      level={shownLevel}
      stageRef={stageRef}
      hud={
        <div className={`hud-card ${s.hud}`}>
          <span className={s.seekLabel}>請找</span>
          <span className={s.seek} key={next} aria-live="polite">
            {finished ? <CheckIcon /> : Math.min(next, total)}
          </span>
          <span className={s.count}>
            已完成 <b key={done}>{done}</b> / {total}
          </span>
          {timed && (
            <span className={shownTime <= 10 && phase === 'play' ? `${s.clock} ${s.clockLow}` : s.clock}>
              <ClockIcon />
              <b>{shownTime}</b>秒
            </span>
          )}
        </div>
      }
    >
      <div className={s.field} style={{ '--r': `${radius}px` } as CSSProperties}>
        {wheel?.map((size, k) => (
          <div
            key={`${level}-disc-${k}`}
            ref={(el) => {
              discEls.current[k] = el;
            }}
            className={k === 0 ? s.disc : `${s.disc} ${s.discInner}`}
            style={{ width: size * 2, height: size * 2 }}
          />
        ))}
        {bubbles.map((b) => (
          <button
            key={`${level}-${b.n}`}
            ref={(el) => {
              if (el) els.current.set(b.n, el);
              else els.current.delete(b.n);
            }}
            type="button"
            className={[s.bubble, b.popped && s.popped, hint === b.n && !b.popped && s.hint].filter(Boolean).join(' ')}
            style={{ '--c': CANDY[b.color].base, '--c-hi': CANDY[b.color].hi, '--c-lo': CANDY[b.color].lo, '--ink': INK[b.color] } as CSSProperties}
            onPointerDown={(e) => {
              if (e.isPrimary && e.button <= 0) tap(b.n);
            }}
            aria-label={`${b.n}`}
          >
            <span className={s.ball}>{b.n}</span>
          </button>
        ))}
      </div>

      <IntroSheet
        open={phase === 'intro'}
        title={GAME.numbers.title}
        art={<NumbersArt />}
        text={
          shownCfg.mode === 'wheel' ? (
            <>
              數字排在 <b>會轉的輪盤</b> 上，
              <br />
              從 1 開始，照順序一個一個點！
            </>
          ) : (
            <>
              數字泡泡會慢慢飄來飄去，
              <br />
              從 <b>1</b> 開始，照順序一個一個點破！
            </>
          )
        }
        say="數字泡泡會慢慢移動。從一開始，照順序，一、二、三，一個一個把它點破。全部點完就過關了。"
        level={saved ?? 1}
        onStart={start}
      />
      <Sheet open={phase === 'timeout'} label="時間到了">
        <div className="sheet__hero" aria-hidden="true">
          <div className={s.timeoutBadge}>
            <ClockIcon />
          </div>
        </div>
        <div className="sheet__body">
          <h2 className="sheet__title">時間到了！</h2>
          <p className="sheet__text">
            已經點了 <b>{done}</b> 個，還差 <b>{total - done}</b> 個。
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
      <WinSheet open={phase === 'win'} level={level} note={note} onNext={() => start(level + 1)} onRestart={() => start(1)} onHome={goHome} />
    </GameShell>
  );
}
