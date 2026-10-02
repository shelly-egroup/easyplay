'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import GameShell from '@/components/GameShell';
import { ClockIcon } from '@/components/icons';
import { IntroSheet, Sheet, usePraise } from '@/components/ui';
import { GAME } from '@/games/registry';
import { floatText, prefersReducedMotion } from '@/lib/fx';
import { useElementSize, usePageVisible, useTimers } from '@/lib/hooks';
import { useGoHome } from '@/lib/nav';
import { buzz, sound } from '@/lib/sound';
import { read, write } from '@/lib/store';
import s from './hoops.module.css';

// 街頭跳投（比分數）：夜晚的街頭球場，側面看過去。
// 每點一下，球就往前、往上跳；籃框一個接一個出現，讓球從上面掉進籃框就得分。
// 連進 3 球變火焰球（×2）、6 球藍火（×3）；投進就重新計時，時間到才結束。

/** 投進幾球之後變多難：rim 籃框寬（幾個球半徑）、amp 籃框上下晃動幅度、clock 每球幾秒、gap 籃框間距、hMin/hMax 籃框高度範圍（畫面比例） */
const TIERS = [
  { at: 0, rim: 4.6, amp: 0, clock: 10, gap: [0.62, 0.74], h: [0.4, 0.52] },
  { at: 4, rim: 4.2, amp: 0, clock: 10, gap: [0.64, 0.84], h: [0.32, 0.58] },
  { at: 9, rim: 3.8, amp: 0, clock: 9, gap: [0.66, 0.9], h: [0.28, 0.6] },
  { at: 14, rim: 3.5, amp: 0.06, clock: 8, gap: [0.68, 0.94], h: [0.3, 0.58] },
  { at: 22, rim: 3.2, amp: 0.09, clock: 7, gap: [0.7, 0.98], h: [0.28, 0.6] },
  { at: 32, rim: 3.0, amp: 0.11, clock: 6, gap: [0.72, 1.0], h: [0.26, 0.62] },
];
const tierFor = (makes: number) => [...TIERS].reverse().find((t) => makes >= t.at)!;
const multFor = (streak: number) => (streak >= 6 ? 3 : streak >= 3 ? 2 : 1);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Hoop = { x: number; base: number; y: number; w: number; amp: number; phase: number; scored: boolean; passed: boolean; touched: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Building = { x: number; w: number; h: number; windows: [number, number][] };
type Phase = 'intro' | 'play' | 'over';

export default function StreetHoops({ modeSwitch, onOtherMode }: { modeSwitch: ReactNode; onOtherMode: () => void }) {
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
  const [started, setStarted] = useState(false);

  const canvasEl = useRef<HTMLCanvasElement>(null);
  const clockEl = useRef<HTMLElement>(null);
  const phaseRef = useRef<Phase>('intro');
  const world = useRef({
    ball: { x: 0, y: 0, vx: 0, vy: 0, rot: 0 },
    cam: 0,
    hoops: [] as Hoop[],
    sparks: [] as Spark[],
    city: [] as Building[],
    score: 0,
    streak: 0,
    makes: 0,
    time: 10,
    t: 0,
    tapped: false,
  });

  useEffect(() => {
    const id = setTimeout(() => setBest(read('hoops.street.best', 0)), 0);
    return () => clearTimeout(id);
  }, []);

  const dims = () => {
    const { w, h } = size.current;
    const R = Math.max(22, Math.min(44, h * 0.055));
    return { w, h, R, floor: h * 0.86, g: h * 2.4, jump: h * 0.86, boost: Math.max(140, w * 0.12), maxVx: Math.max(260, w * 0.42) };
  };

  const addHoop = (afterX: number) => {
    const d = dims();
    const st = world.current;
    const tier = tierFor(st.makes);
    const x = afterX + rand(tier.gap[0], tier.gap[1]) * Math.max(520, d.w);
    const base = d.h * rand(tier.h[0], tier.h[1]);
    st.hoops.push({ x, base, y: base, w: tier.rim * d.R, amp: tier.amp * d.h, phase: Math.random() * 6, scored: false, passed: false, touched: false });
  };

  const start = () => {
    timers.clear();
    const d = dims();
    const st = world.current;
    st.ball = { x: d.w * 0.18, y: d.floor - d.R, vx: 0, vy: 0, rot: 0 };
    st.cam = 0;
    st.hoops = [];
    st.sparks = [];
    st.score = 0;
    st.streak = 0;
    st.makes = 0;
    st.time = 10;
    st.t = 0;
    st.tapped = false;
    st.city = Array.from({ length: 36 }, (_, i) => {
      const w = rand(50, 130);
      const h = d.h * rand(0.16, 0.42);
      const windows: [number, number][] = [];
      for (let y = 14; y < h - 10; y += 18) for (let x = 10; x < w - 10; x += 16) if (Math.random() < 0.35) windows.push([x, y]);
      return { x: i * 120 + rand(-20, 20), w, h, windows };
    });
    // 第一個籃框放近一點、高度剛好，先讓長輩投進一次
    st.hoops.push({ x: d.w * 0.62, base: d.h * 0.5, y: d.h * 0.5, w: TIERS[0].rim * d.R, amp: 0, phase: 0, scored: false, passed: false, touched: false });
    addHoop(st.hoops[0].x);
    addHoop(st.hoops[1].x);
    setScore(0);
    setStreak(0);
    setSeconds(10);
    setRecord(false);
    setStarted(false);
    phaseRef.current = 'play';
    setPhase('play');
  };

  const end = () => {
    phaseRef.current = 'over';
    setPhase('over');
    sound.nope();
    const prev = read('hoops.street.best', 0);
    if (world.current.score > prev) {
      write('hoops.street.best', world.current.score);
      setBest(world.current.score);
      setRecord(true);
      timers.after(300, () => sound.win());
    }
  };

  const tap = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary || e.button > 0 || phaseRef.current !== 'play') return;
    sound.unlock();
    const d = dims();
    const b = world.current.ball;
    b.vy = -d.jump;
    b.vx = Math.min(d.maxVx, Math.max(b.vx, 0) + d.boost);
    if (!world.current.tapped) {
      world.current.tapped = true;
      setStarted(true);
    }
    sound.tap();
    buzz(8);
  };

  // 主迴圈：物理、判斷進球、畫畫面
  useEffect(() => {
    if (phase !== 'play' || !visible) return;
    const canvas = canvasEl.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = prefersReducedMotion();
    let raf = 0;
    let last = performance.now();
    let shownSec = -1;

    const made = (hoop: Hoop) => {
      const st = world.current;
      const mult = multFor(st.streak);
      const gained = (hoop.touched ? 2 : 3) * mult;
      st.streak += 1;
      st.makes += 1;
      st.score += gained;
      st.time = tierFor(st.makes).clock;
      setScore(st.score);
      setStreak(st.streak);
      sound.swish(mult);
      buzz(mult > 1 ? [20, 30, 20] : 18);
      const d = dims();
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = rand(80, 320);
        st.sparks.push({ x: hoop.x, y: hoop.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0, max: rand(0.4, 0.8), color: mult > 2 ? '#9fd4ff' : mult > 1 ? '#ffb13b' : '#ffe7a8', size: rand(2, 5) });
      }
      const rect = canvas.getBoundingClientRect();
      floatText(rect.left + hoop.x - st.cam, rect.top + hoop.y - d.R * 2, hoop.touched ? `+${gained}` : `空心 +${gained}`, mult > 2 ? '#7ebbff' : '#ffb13b');
      if (st.streak === 3) praise.show('火焰球！');
      else if (st.streak === 6) praise.show('超級火焰！');
      else if (st.makes === TIERS[3].at) praise.show('籃框會上下動囉！');
    };
    const missed = () => {
      const st = world.current;
      if (st.streak >= 3) praise.show('火焰熄滅了');
      st.streak = 0;
      setStreak(0);
    };

    const step = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const d = dims();
      const st = world.current;
      const b = st.ball;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(d.w * dpr) || canvas.height !== Math.round(d.h * dpr)) {
        canvas.width = Math.round(d.w * dpr);
        canvas.height = Math.round(d.h * dpr);
      }
      st.t += dt;

      // 球的物理
      const prevY = b.y;
      b.vy += d.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= Math.exp(-(b.y >= d.floor - d.R - 1 ? 2.4 : 0.32) * dt);
      b.rot += (b.vx * dt) / d.R;
      if (b.y > d.floor - d.R) {
        b.y = d.floor - d.R;
        b.vy = Math.abs(b.vy) > 160 ? -Math.abs(b.vy) * 0.45 : 0;
      }
      if (b.y < d.R) {
        b.y = d.R;
        b.vy = Math.max(0, b.vy);
      }

      // 籃框
      for (const hoop of st.hoops) {
        hoop.y = hoop.base + (reduce ? 0 : Math.sin(st.t * 1.3 + hoop.phase) * hoop.amp);
        const left = hoop.x - hoop.w / 2;
        const right = hoop.x + hoop.w / 2;
        // 碰到籃框前後兩端就彈開
        for (const tipX of [left, right]) {
          const dx = b.x - tipX;
          const dy = b.y - hoop.y;
          const dist = Math.hypot(dx, dy);
          if (dist < d.R + 3 && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            b.x = tipX + nx * (d.R + 3);
            b.y = hoop.y + ny * (d.R + 3);
            const dot = b.vx * nx + b.vy * ny;
            if (dot < 0) {
              b.vx -= 1.5 * dot * nx;
              b.vy -= 1.5 * dot * ny;
            }
            if (!hoop.touched) sound.clank();
            hoop.touched = true;
          }
        }
        // 籃板
        const board = right + d.R * 0.5;
        if (b.vx > 0 && b.x + d.R > board && b.x < board && b.y > hoop.y - d.R * 4.6 && b.y < hoop.y + d.R * 0.3) {
          b.x = board - d.R;
          b.vx = -b.vx * 0.45;
          hoop.touched = true;
        }
        if (!hoop.scored && b.vy > 0 && prevY < hoop.y && b.y >= hoop.y && b.x > left + d.R * 0.45 && b.x < right - d.R * 0.45) {
          hoop.scored = true;
          made(hoop);
        }
        if (!hoop.scored && !hoop.passed && b.x - d.R > board + 10) {
          hoop.passed = true;
          missed();
        }
      }
      while (st.hoops.length && st.hoops[0].x < st.cam - d.w * 0.5) st.hoops.shift();
      while (st.hoops.length < 3 || st.hoops[st.hoops.length - 1].x < st.cam + d.w * 1.6) addHoop(st.hoops[st.hoops.length - 1]?.x ?? b.x);

      // 鏡頭跟著球
      st.cam += (b.x - d.w * 0.3 - st.cam) * Math.min(1, dt * 4);
      if (st.cam < 0) st.cam = 0;

      // 火花、火焰
      const mult = multFor(st.streak);
      if (mult > 1 && !reduce) {
        for (let i = 0; i < 3; i++) {
          st.sparks.push({ x: b.x - b.vx * 0.02 + rand(-d.R, d.R) * 0.5, y: b.y + rand(-d.R, d.R) * 0.5, vx: -b.vx * 0.3 + rand(-30, 30), vy: -b.vy * 0.2 - rand(20, 80), life: 0, max: rand(0.25, 0.5), color: mult > 2 ? (i ? '#7ebbff' : '#e8f6ff') : i ? '#ff6a1f' : '#ffd36e', size: rand(d.R * 0.25, d.R * 0.55) });
        }
      }
      st.sparks = st.sparks.filter((p) => {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
        return p.life < p.max;
      });

      draw(ctx, dpr, d, st);

      // 倒數
      if (st.tapped) st.time = Math.max(0, st.time - dt);
      if (clockEl.current) clockEl.current.style.width = `${(st.time / tierFor(st.makes).clock) * 100}%`;
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
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 迴圈只依遊戲狀態重啟
  }, [phase, visible]);

  const fire = multFor(streak) - 1;

  return (
    <GameShell
      game={GAME.hoops}
      badge={`最高 ${best} 分`}
      stageRef={stageRef}
      hud={
        <div className={s.hud}>
          <span className={`hud-card ${s.score}`}>
            分數 <b key={score}>{score}</b>
            {fire > 0 && <span className={fire > 1 ? `${s.combo} ${s.comboBlue}` : s.combo}>🔥 ×{fire + 1}</span>}
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
      <div className={s.street}>
        <canvas ref={canvasEl} className={s.streetCanvas} onPointerDown={tap} aria-label="街頭球場，點一下讓球往前跳" />
        {phase === 'play' && !started && <div className={s.tapHint}>點一下，球會往前跳 👆</div>}
      </div>
      {praise.node}

      <IntroSheet
        open={phase === 'intro'}
        title="街頭跳投"
        art={<StreetArt />}
        text={
          <>
            每點一下，球就 <b>往前跳</b>。
            <br />
            讓球從上面掉進籃框！連進會變火焰球。
          </>
        }
        say="每點一下，球就會往前、往上跳。讓球從上面掉進籃框就得分，空心進球分數更高。連續投進會變成火焰球。投進會重新計時，時間到就結束。"
        tag={best > 0 ? `最高 ${best} 分` : undefined}
        extra={modeSwitch}
        onStart={start}
      />
      <Sheet open={phase === 'over'} label="時間到了" confetti={record}>
        <div className="sheet__hero" aria-hidden="true">
          <StreetArt still />
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
            <button className="btn btn--ghost" type="button" onClick={onOtherMode}>
              換成定點投籃
            </button>
            <button className="btn btn--quiet" type="button" onClick={goHome}>
              休息一下，回首頁
            </button>
          </div>
        </div>
      </Sheet>
    </GameShell>
  );
}

type Dims = { w: number; h: number; R: number; floor: number };
type World = { ball: { x: number; y: number; vx: number; vy: number; rot: number }; cam: number; hoops: Hoop[]; sparks: Spark[]; city: Building[]; streak: number };

// 畫面：夜晚城市 → 鐵絲網 → 柏油地 → 籃框（後半）→ 球 → 籃網與籃框（前半）→ 火花
function draw(ctx: CanvasRenderingContext2D, dpr: number, d: Dims, st: World) {
  const { w, h, R, floor } = d;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sky = ctx.createLinearGradient(0, 0, 0, floor);
  sky.addColorStop(0, '#0b1026');
  sky.addColorStop(0.6, '#1b1f4a');
  sky.addColorStop(1, '#3b2b5c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 路燈的光
  for (const lx of [0.18, 0.82]) {
    const glow = ctx.createRadialGradient(w * lx, 0, 0, w * lx, 0, h * 0.9);
    glow.addColorStop(0, 'rgba(255,230,180,0.22)');
    glow.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  // 城市剪影（遠，慢慢移）
  const period = 36 * 120;
  const off = (st.cam * 0.15) % period;
  for (const b of st.city) {
    for (const rep of [0, period]) {
      const x = b.x - off + rep - 60;
      if (x > w || x + b.w < 0) continue;
      ctx.fillStyle = '#141838';
      ctx.fillRect(x, floor - h * 0.08 - b.h, b.w, b.h + h * 0.08);
      ctx.fillStyle = 'rgba(255,210,122,0.55)';
      for (const [wx, wy] of b.windows) ctx.fillRect(x + wx, floor - h * 0.08 - b.h + wy, 6, 8);
    }
  }

  // 鐵絲網（中景）
  const fenceTop = floor - h * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, fenceTop, w, floor - fenceTop);
  ctx.clip();
  ctx.strokeStyle = 'rgba(190,200,230,0.12)';
  ctx.lineWidth = 1.5;
  const mesh = 26;
  const fo = (st.cam * 0.55) % mesh;
  for (let x = -h; x < w + h; x += mesh) {
    ctx.beginPath();
    ctx.moveTo(x - fo, fenceTop);
    ctx.lineTo(x - fo + (floor - fenceTop), floor);
    ctx.moveTo(x - fo, floor);
    ctx.lineTo(x - fo + (floor - fenceTop), fenceTop);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#2a2f52';
  const po = (st.cam * 0.55) % 220;
  for (let x = -po; x < w; x += 220) ctx.fillRect(x, fenceTop - 8, 7, floor - fenceTop + 8);
  ctx.fillRect(0, fenceTop - 8, w, 4);

  // 柏油地
  const ground = ctx.createLinearGradient(0, floor, 0, h);
  ground.addColorStop(0, '#34374f');
  ground.addColorStop(1, '#1d1f30');
  ctx.fillStyle = ground;
  ctx.fillRect(0, floor, w, h - floor);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(0, floor, w, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  const lo = st.cam % 300;
  for (let x = -lo; x < w; x += 300) ctx.fillRect(x, floor + (h - floor) * 0.45, 120, 4);

  // 球的影子
  const b = st.ball;
  const sx = b.x - st.cam;
  const lift = Math.min(1, (floor - R - b.y) / (h * 0.6));
  ctx.fillStyle = `rgba(0,0,0,${0.35 - lift * 0.22})`;
  ctx.beginPath();
  ctx.ellipse(sx, floor + 4, R * (1.1 - lift * 0.5), R * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 籃框後半：柱子、籃板、後面的框
  for (const hoop of st.hoops) {
    const hx = hoop.x - st.cam;
    if (hx < -w * 0.3 || hx > w * 1.3) continue;
    const right = hx + hoop.w / 2;
    const board = right + R * 0.5;
    const pole = ctx.createLinearGradient(board + R * 0.9, 0, board + R * 1.5, 0);
    pole.addColorStop(0, '#5b6178');
    pole.addColorStop(1, '#2e3247');
    ctx.fillStyle = pole;
    ctx.fillRect(board + R * 0.9, hoop.y - R * 1.6, R * 0.55, floor - hoop.y + R * 1.6);
    ctx.fillRect(board, hoop.y - R * 1.4, R * 1.2, R * 0.28);
    ctx.fillStyle = 'rgba(210,230,255,0.28)';
    ctx.strokeStyle = 'rgba(235,245,255,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    // 舊瀏覽器沒有 roundRect 就畫直角
    if (ctx.roundRect) ctx.roundRect(board, hoop.y - R * 4.8, R * 0.45, R * 5.2, 4);
    else ctx.rect(board, hoop.y - R * 4.8, R * 0.45, R * 5.2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#b8400f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(hx, hoop.y, hoop.w / 2, R * 0.32, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  // 球（火焰尾巴在後面）
  for (const p of st.sparks) {
    const k = 1 - p.life / p.max;
    ctx.globalAlpha = Math.max(0, k);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - st.cam, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const fire = st.streak >= 3;
  if (fire) {
    ctx.shadowColor = st.streak >= 6 ? '#7ebbff' : '#ff8a3d';
    ctx.shadowBlur = R * 1.2;
  }
  const ball = ctx.createRadialGradient(sx - R * 0.35, b.y - R * 0.4, R * 0.1, sx, b.y, R);
  ball.addColorStop(0, '#ffb26b');
  ball.addColorStop(0.55, '#e86a1e');
  ball.addColorStop(1, '#8a3a0c');
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(sx, b.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, b.y, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(sx, b.y);
  ctx.rotate(b.rot);
  ctx.strokeStyle = 'rgba(40,14,2,0.85)';
  ctx.lineWidth = Math.max(1.6, R * 0.07);
  ctx.beginPath();
  ctx.moveTo(-R, 0);
  ctx.lineTo(R, 0);
  ctx.moveTo(0, -R);
  ctx.lineTo(0, R);
  ctx.moveTo(-R * 0.75, -R * 0.75);
  ctx.quadraticCurveTo(-R * 0.15, 0, -R * 0.75, R * 0.75);
  ctx.moveTo(R * 0.75, -R * 0.75);
  ctx.quadraticCurveTo(R * 0.15, 0, R * 0.75, R * 0.75);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(sx - R * 0.38, b.y - R * 0.45, R * 0.32, R * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // 籃網與前面的框
  for (const hoop of st.hoops) {
    const hx = hoop.x - st.cam;
    if (hx < -w * 0.3 || hx > w * 1.3) continue;
    const half = hoop.w / 2;
    const depth = R * 1.9;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const top = hx - half + hoop.w * t;
      const bot = hx - half * 0.62 + half * 1.24 * t;
      ctx.moveTo(top, hoop.y);
      ctx.lineTo(bot, hoop.y + depth);
    }
    for (let j = 1; j <= 3; j++) {
      const t = j / 3;
      const half2 = half * (1 - 0.38 * t);
      ctx.moveTo(hx - half2, hoop.y + depth * t);
      ctx.lineTo(hx + half2, hoop.y + depth * t);
    }
    ctx.stroke();
    ctx.strokeStyle = '#ff6a1f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(hx, hoop.y, half, R * 0.32, 0, 0, Math.PI);
    ctx.stroke();
  }
}

// 說明／結束畫面的小插圖（夜晚球場）
function StreetArt({ still }: { still?: boolean }) {
  return (
    <div className={still ? `${s.streetDemo} ${s.still}` : s.streetDemo}>
      <span className={s.sdHoop} />
      <span className={s.sdBall} />
      {!still && (
        <span className={`demo-hand ${s.sdHand}`} aria-hidden="true">
          👆
        </span>
      )}
    </div>
  );
}
