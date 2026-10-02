'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { prefersReducedMotion } from '@/lib/fx';
import { buzz, sound } from '@/lib/sound';
import { canSpeak, hush, speak } from '@/lib/speech';
import { ArrowIcon, CheckIcon, TalkIcon } from './icons';

/** 只在瀏覽器端才是 true（避免預先產生的畫面和實際畫面不一致） */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/* ---------- 進度膠囊 ---------- */
export function Meter({ value, max, children }: { value: number; max: number; children: ReactNode }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="hud-card meter">
      <div className="meter__text">{children}</div>
      <div className="meter__track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <i className="meter__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- 彈出卡片（進場、退場都有動畫） ---------- */
export function Sheet({ open, label, confetti, children }: { open: boolean; label: string; confetti?: boolean; children: ReactNode }) {
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);
  if (!rendered) return null;
  return (
    <div
      className={open ? 'sheet-backdrop' : 'sheet-backdrop is-out'}
      onAnimationEnd={(e) => {
        if (!open && e.target === e.currentTarget) setRendered(false);
      }}
    >
      {confetti && open && <Confetti />}
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function IntroSheet(props: {
  open: boolean;
  title: string;
  art: ReactNode;
  text: ReactNode;
  say: string;
  /** 沒有關卡的遊戲（例如投籃）不用傳，改用 tag 顯示最高分之類的資訊 */
  level?: number;
  tag?: ReactNode;
  /** 說明文字和按鈕之間的額外內容（例如切換玩法） */
  extra?: ReactNode;
  onStart: (level: number) => void;
}) {
  const hydrated = useHydrated();
  const { open, title, art, text, say, level = 1, tag, onStart } = props;
  const leveled = props.level !== undefined;
  const go = (n: number) => {
    sound.unlock();
    sound.tap();
    hush();
    onStart(n);
  };
  return (
    <Sheet open={open} label={`${title} 玩法說明`}>
      <div className="sheet__hero" aria-hidden="true">
        {art}
      </div>
      <div className="sheet__body">
        <h2 className="sheet__title">{title}</h2>
        <p className="sheet__text">{text}</p>
        {props.extra}
        <div className="sheet__actions">
          <button className="btn btn--primary" type="button" onClick={() => go(level)}>
            開始玩{leveled ? <small>第 {level} 關</small> : tag && <small>{tag}</small>}
          </button>
          {leveled && level > 1 && (
            <button className="btn btn--ghost" type="button" onClick={() => go(1)}>
              從第 1 關重新開始
            </button>
          )}
          {hydrated && canSpeak() && (
            <button className="btn btn--quiet" type="button" onClick={() => speak(say)}>
              <TalkIcon />
              <span>唸給我聽</span>
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

const CHEERS = ['您真厲害！', '做得太好了！', '好棒好棒！', '真是高手！', '太精彩了！'];

export function WinSheet({
  open,
  level,
  message,
  note,
  onNext,
  onRestart,
  onHome,
}: {
  open: boolean;
  level: number;
  message?: ReactNode;
  note?: ReactNode;
  onNext: () => void;
  onRestart?: () => void;
  onHome: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    sound.win();
    buzz([30, 70, 30]);
  }, [open]);
  return (
    <Sheet open={open} label="過關了" confetti>
      <div className="sheet__hero win" aria-hidden="true">
        <span className="win__rays" />
        <div className="win__badge">
          <CheckIcon />
        </div>
      </div>
      <div className="sheet__body">
        <p className="win__kicker">第 {level} 關</p>
        <h2 className="sheet__title">過關了！</h2>
        <p className="sheet__text">{message ?? CHEERS[level % CHEERS.length]}</p>
        {note && <p className="win__note">{note}</p>}
        <div className="sheet__actions">
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => {
              sound.tap();
              onNext();
            }}
          >
            下一關
            <ArrowIcon />
          </button>
          <button className="btn btn--ghost" type="button" onClick={onHome}>
            休息一下，回首頁
          </button>
          {onRestart && (
            <button className="btn btn--quiet" type="button" onClick={onRestart}>
              從第 1 關重新開始
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- 彩帶：從左右兩邊噴出 ---------- */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || prefersReducedMotion()) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#EE4B3B', '#2E6CE6', '#FFAA14', '#22A55B', '#8B57E0', '#FF8FB1', '#FFFFFF'];
    const power = Math.max(15, Math.min(27, H / 32));
    const parts = Array.from({ length: 160 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = 0.2 + Math.random() * 0.6;
      const speed = power * (0.55 + Math.random() * 0.6);
      return {
        x: fromLeft ? -10 : W + 10,
        y: H * (0.68 + Math.random() * 0.22),
        vx: Math.sin(angle) * speed * (fromLeft ? 1 : -1),
        vy: -Math.cos(angle) * speed,
        w: 8 + Math.random() * 8,
        h: 12 + Math.random() * 10,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.35,
        tilt: Math.random() * 6,
        color: colors[i % colors.length],
        round: i % 3 === 0,
        delay: Math.random() * 280,
      };
    });
    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    const frame = (now: number) => {
      const k = Math.min(2.5, (now - last) / 16.67);
      last = now;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        if (now - t0 < p.delay) continue;
        p.vy += 0.42 * k;
        p.vx *= Math.pow(0.986, k);
        p.vy *= Math.pow(0.986, k);
        p.x += p.vx * k;
        p.y += p.vy * k;
        p.rot += p.vr * k;
        p.tilt += 0.12 * k;
        const sy = Math.cos(p.tilt);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.w / 2, Math.max(1, (p.w / 2) * Math.abs(sy)), 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, (-p.h / 2) * sy, p.w, p.h * sy);
        }
        ctx.restore();
      }
      if (now - t0 < 5200) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}

/* ---------- 大字稱讚（很好！太棒了！） ---------- */
export function usePraise() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  const seq = useRef(0);
  const show = useCallback((text: string) => {
    const id = ++seq.current;
    setItems((list) => [...list.slice(-1), { id, text }]);
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), 1500);
  }, []);
  const node = items.map((i) => (
    <div key={i.id} className="praise" aria-hidden="true">
      {i.text}
    </div>
  ));
  return { node, show };
}
