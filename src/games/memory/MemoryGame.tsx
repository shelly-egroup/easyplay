'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import GameShell from '@/components/GameShell';
import { CheckIcon, EyeIcon } from '@/components/icons';
import { IntroSheet, usePraise, WinSheet } from '@/components/ui';
import { GAME } from '@/games/registry';
import { burst, shake } from '@/lib/fx';
import { fitGrid, shuffle, useElementSize, useTimers } from '@/lib/hooks';
import { useGoHome } from '@/lib/nav';
import { buzz, sound } from '@/lib/sound';
import { floatText } from '@/lib/fx';
import { useRunScore, type Banked } from '@/lib/score';
import { saveLevel, useSavedLevel } from '@/lib/store';
import MemoryArt from './MemoryArt';
import s from './memory.module.css';

// 前六種顏色差最多，前兩關只用這六種
const FRUITS = [
  { e: '🍎', n: '蘋果', tint: '#FFE0DA' },
  { e: '🍌', n: '香蕉', tint: '#FFF2BF' },
  { e: '🍇', n: '葡萄', tint: '#ECDDFF' },
  { e: '🍉', n: '西瓜', tint: '#D9F3DF' },
  { e: '🍊', n: '橘子', tint: '#FFE3C7' },
  { e: '🍍', n: '鳳梨', tint: '#FCEFC2' },
  { e: '🍓', n: '草莓', tint: '#FFDCE5' },
  { e: '🍑', n: '桃子', tint: '#FFE2D6' },
  { e: '🍒', n: '櫻桃', tint: '#FFD9DA' },
  { e: '🍋', n: '檸檬', tint: '#F8F4C4' },
  { e: '🍐', n: '梨子', tint: '#E6F3CC' },
  { e: '🍈', n: '哈密瓜', tint: '#E0F2D6' },
];

/* 想調難度改這裡：每一關有幾對牌 */
const PAIRS = [3, 4, 6, 8, 10, 12];
const pairsFor = (n: number) => PAIRS[Math.min(PAIRS.length, n) - 1];
const previewFor = (pairs: number) => 2600 + pairs * 300;
// 分數（會一關一關累積）：每找到一對 2×關卡；過關 5×關卡；一次都沒翻錯再加 3×關卡
const PAIR_POINTS = 2;
const CLEAR_POINTS = 5;
const PERFECT_POINTS = 3;

type Card = { id: number; fruit: number; up: boolean; done: boolean };
type Phase = 'intro' | 'preview' | 'play' | 'win';

export default function MemoryGame() {
  const saved = useSavedLevel('memory');
  const goHome = useGoHome();
  const timers = useTimers();
  const praise = usePraise();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();

  const [phase, setPhase] = useState<Phase>('intro');
  const [level, setLevel] = useState(1);
  const [cards, setCards] = useState<Card[]>([]);
  const [found, setFound] = useState(0);
  const [peeking, setPeeking] = useState(false);
  const run = useRunScore('memory');
  const [banked, setBanked] = useState<Banked | null>(null);
  const mistakes = useRef(0);
  const [perfect, setPerfect] = useState(false);

  const cardsRef = useRef<Card[]>([]);
  const phaseRef = useRef<Phase>('intro');
  const levelRef = useRef(1);
  const foundRef = useRef(0);
  const lock = useRef(true);
  const first = useRef<number | null>(null);
  const pending = useRef<{ a: number; b: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const cardEls = useRef(new Map<number, HTMLButtonElement>());

  const commit = useCallback((next: Card[]) => {
    cardsRef.current = next;
    setCards(next);
  }, []);
  const goPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const shownLevel = phase === 'intro' ? (saved ?? 1) : level;
  const pairs = pairsFor(shownLevel);
  const gap = stage.width < 520 ? 10 : 16;
  const fit = fitGrid(pairs * 2, stage.width, stage.height, gap, { ratio: 0.78, minRatio: 0.62, maxRatio: 1.05 });

  const start = (n: number) => {
    timers.clear();
    levelRef.current = n;
    setLevel(n);
    saveLevel('memory', n);
    foundRef.current = 0;
    setFound(0);
    run.begin(n);
    setBanked(null);
    mistakes.current = 0;
    first.current = null;
    pending.current = null;
    lock.current = true;
    const p = pairsFor(n);
    const pool = [...FRUITS.keys()].slice(0, n <= 2 ? 6 : FRUITS.length);
    const chosen = shuffle(pool).slice(0, p);
    const deck = shuffle(chosen.flatMap((f) => [f, f])).map((fruit, i) => ({ id: n * 100 + i, fruit, up: false, done: false }));
    commit(deck);
    goPhase('preview');
    // 先發牌，再全部翻開讓您記一記，時間到再蓋回去
    const preview = previewFor(p);
    timers.after(700, () => {
      commit(cardsRef.current.map((c) => ({ ...c, up: true })));
      sound.flip();
    });
    timers.after(700 + preview, () => {
      commit(cardsRef.current.map((c) => ({ ...c, up: false })));
      sound.flip();
      goPhase('play');
    });
    timers.after(700 + preview + 600, () => {
      lock.current = false;
    });
  };

  const center = (id: number) => {
    const r = cardEls.current.get(id)?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };

  // 翻錯的兩張還沒蓋回去時，直接點下一張就會馬上蓋回，不用等
  const coverPending = () => {
    const p = pending.current;
    if (!p) return;
    timers.cancel(p.timer);
    pending.current = null;
    commit(cardsRef.current.map((c) => (c.id === p.a || c.id === p.b ? { ...c, up: false } : c)));
  };

  const flip = (id: number) => {
    sound.unlock();
    if (lock.current || phaseRef.current !== 'play') return;
    const p = pending.current;
    const card = cardsRef.current.find((c) => c.id === id);
    if (!card || card.done || (card.up && !(p && (p.a === id || p.b === id)))) return;
    if (p) {
      coverPending();
      if (p.a === id || p.b === id) return;
    }
    sound.flip();
    commit(cardsRef.current.map((c) => (c.id === id ? { ...c, up: true } : c)));

    if (first.current === null) {
      first.current = id;
      return;
    }
    const a = cardsRef.current.find((c) => c.id === first.current)!;
    first.current = null;

    if (a.fruit === card.fruit) {
      // 一樣：打勾、發光，然後兩張一起消失
      commit(cardsRef.current.map((c) => (c.id === a.id || c.id === card.id ? { ...c, done: true } : c)));
      timers.after(380, () => {
        sound.good();
        buzz(20);
        for (const pt of [center(a.id), center(card.id)]) if (pt) burst(pt.x, pt.y, '#4A9BF6', 10, 90);
      });
      foundRef.current += 1;
      setFound(foundRef.current);
      const L = levelRef.current;
      run.add(PAIR_POINTS * L);
      timers.after(380, () => {
        const pt = center(card.id);
        if (pt) floatText(pt.x, pt.y, `+${PAIR_POINTS * L}`, '#1C5BB0');
      });
      if (foundRef.current === pairsFor(L)) {
        lock.current = true;
        run.add(CLEAR_POINTS * L + (mistakes.current === 0 ? PERFECT_POINTS * L : 0));
        timers.after(1200, () => {
          setBanked(run.bank());
          setPerfect(mistakes.current === 0);
          saveLevel('memory', levelRef.current + 1);
          goPhase('win');
        });
      } else {
        timers.after(380, () => praise.show('找到了！'));
      }
    } else {
      // 不一樣：多留一點時間看清楚，再輕輕蓋回去（不扣分）
      mistakes.current += 1;
      const timer = timers.after(1400, () => {
        for (const x of [a.id, card.id]) shake(cardEls.current.get(x)?.firstElementChild);
        timers.after(260, () => {
          if (pending.current?.timer !== timer) return;
          pending.current = null;
          commit(cardsRef.current.map((c) => (c.id === a.id || c.id === card.id ? { ...c, up: false } : c)));
          sound.flip();
        });
      });
      pending.current = { a: a.id, b: card.id, timer };
    }
  };

  const peek = () => {
    sound.unlock();
    if (lock.current || phaseRef.current !== 'play') return;
    coverPending();
    lock.current = true;
    first.current = null;
    setPeeking(true);
    sound.flip();
    commit(cardsRef.current.map((c) => (c.done ? c : { ...c, up: true })));
    timers.after(1900, () => {
      commit(cardsRef.current.map((c) => (c.done ? c : { ...c, up: false })));
      sound.flip();
      setPeeking(false);
      timers.after(500, () => {
        lock.current = false;
      });
    });
  };

  const hud =
    phase === 'preview' ? (
      <div className={s.memorize} key={`m${level}`}>
        <span>先記住它們的位置</span>
        <i style={{ animationDuration: `${previewFor(pairs) + 700}ms` }} />
      </div>
    ) : (
      <div className={s.hud}>
        <div className="hud-card">
          <div className={s.pips} aria-hidden="true">
            {Array.from({ length: pairs }, (_, i) => (
              <i key={i} className={i < found ? s.pipOn : undefined} />
            ))}
          </div>
          <span className={s.count}>
            找到 <b key={found}>{found}</b> / {pairs} 對
          </span>
        </div>
        <span className="hud-card total-card">
          總分 <b key={run.total}>{run.total.toLocaleString()}</b>
        </span>
        <button className={`pill ${s.peek}`} type="button" onClick={peek} disabled={phase !== 'play' || peeking}>
          <EyeIcon />
          <span>偷看一下</span>
        </button>
      </div>
    );

  const next = pairsFor(level + 1);
  const showNames = fit.h >= 150;

  return (
    <GameShell game={GAME.memory} level={shownLevel} stageRef={stageRef} hud={hud}>
      <div
        className={s.grid}
        style={{ '--cols': fit.cols, '--w': `${fit.w}px`, '--h': `${fit.h}px`, '--gap': `${gap}px`, visibility: stage.width ? 'visible' : 'hidden' } as CSSProperties}
      >
        {cards.map((c, i) => {
          const f = FRUITS[c.fruit];
          const open = c.up || c.done;
          return (
            <button
              key={c.id}
              ref={(el) => {
                if (el) cardEls.current.set(c.id, el);
                else cardEls.current.delete(c.id);
              }}
              type="button"
              className={[s.card, open && s.up, c.done && s.done].filter(Boolean).join(' ')}
              style={{ '--i': i } as CSSProperties}
              onPointerDown={(e) => {
                if (e.isPrimary && e.button <= 0) flip(c.id);
              }}
              aria-label={open ? f.n : '蓋著的牌，點一下翻開'}
            >
              <span className={s.wob}>
                <span className={s.inner}>
                  <span className={`${s.face} ${s.back}`}>
                    <span className={s.backMark}>?</span>
                  </span>
                  <span className={`${s.face} ${s.front}`} style={{ '--tint': f.tint } as CSSProperties}>
                    <span className={s.emoji}>
                      <span>{f.e}</span>
                    </span>
                    {showNames && <span className={s.name}>{f.n}</span>}
                    <span className={s.ok}>
                      <CheckIcon />
                    </span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {praise.node}

      <IntroSheet
        open={phase === 'intro'}
        title={GAME.memory.title}
        art={<MemoryArt />}
        text={
          <>
            先記住水果的位置，
            <br />
            再一次翻兩張，找出 <b>一樣的一對</b>！
          </>
        }
        say="一開始會讓您先看一看，記住水果的位置。然後一次翻兩張牌，找出一樣的一對。全部找到就過關了。"
        level={saved ?? 1}
        onStart={start}
      />
      <WinSheet
        open={phase === 'win'}
        level={level}
        message={perfect ? '一次都沒翻錯，記性真好！' : undefined}
        points={banked}
        note={next > pairsFor(level) ? `下一關有 ${next * 2} 張牌` : '下一關的水果會換一換'}
        onNext={() => start(level + 1)}
        onRestart={() => start(1)}
        onHome={goHome}
      />
    </GameShell>
  );
}
