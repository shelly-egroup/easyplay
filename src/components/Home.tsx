'use client';

import Link from 'next/link';
import { useSyncExternalStore, ViewTransition, type CSSProperties, type ReactNode } from 'react';
import { GAMES, type GameId, type GameMeta } from '@/games/registry';
import { markFromHome } from '@/lib/nav';
import { sound, useSoundOn } from '@/lib/sound';
import { useSavedLevel, useStoredNumber } from '@/lib/store';
import { BricksHero, HoopsHero, MemoryHero, MoleHero, NumbersHero, PopHero } from './art/Heroes';
import { BrandMark, PlayIcon, SoundOffIcon, SoundOnIcon } from './icons';
import s from './Home.module.css';

const HERO: Record<GameId, ReactNode> = {
  pop: <PopHero />,
  memory: <MemoryHero />,
  numbers: <NumbersHero />,
  mole: <MoleHero />,
  hoops: <HoopsHero />,
  bricks: <BricksHero />,
};

// 每 30 秒更新一次問候語、日期、時間
function useMinute() {
  return useSyncExternalStore(
    (fn) => {
      const id = setInterval(fn, 30_000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 60_000),
    () => null
  );
}

function greeting(h: number) {
  if (h < 5) return '夜深了';
  if (h < 11) return '早安！';
  if (h < 14) return '午安！';
  if (h < 18) return '下午好！';
  return '晚上好！';
}

export default function Home() {
  const minute = useMinute();
  const soundOn = useSoundOn();
  const now = minute === null ? null : new Date(minute * 60_000);
  const night = !!now && (now.getHours() >= 18 || now.getHours() < 5);

  return (
    <main className={`${s.home} mesh`}>
      <header className={s.top}>
        <div className={s.brand}>
          <BrandMark className={s.mark} />
          <span>easyplay</span>
        </div>
        <button className="pill pill--icon" type="button" onClick={() => sound.toggle()} aria-label={soundOn ? '聲音開著，點一下關掉' : '聲音關著，點一下打開'}>
          {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
        </button>
      </header>

      <section className={now ? s.hello : `${s.hello} ${s.waiting}`} aria-live="polite">
        <SkyIcon night={night} />
        <h1 className={s.greet}>{now ? greeting(now.getHours()) : ' '}</h1>
        <p className={s.sub}>今天想玩什麼呢？</p>
        <p className={s.date}>
          {now && (
            <>
              <span>
                {now.getMonth() + 1} 月 {now.getDate()} 日
              </span>
              <span className={s.dot} />
              <span>星期{'日一二三四五六'[now.getDay()]}</span>
              <span className={s.dot} />
              <span className={s.time}>
                {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
              </span>
            </>
          )}
        </p>
      </section>

      <nav className={s.cards} aria-label="選一個遊戲">
        {GAMES.map((g, i) => (
          <GameCard key={g.id} game={g} index={i} />
        ))}
      </nav>
    </main>
  );
}

// 白天是慢慢轉的太陽，晚上是月亮和星星
function SkyIcon({ night }: { night: boolean }) {
  return (
    <div className={s.sky} aria-hidden="true">
      {night ? (
        <svg viewBox="0 0 100 100">
          <defs>
            <linearGradient id="moon" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor="#FFE08A" />
              <stop offset="1" stopColor="#FFB938" />
            </linearGradient>
          </defs>
          <path d="M60 12a38 38 0 1 0 28 62A32 32 0 0 1 60 12z" fill="url(#moon)" />
          <path className={s.twinkle} d="M80 16l2.6 6.4L89 25l-6.4 2.6L80 34l-2.6-6.4L71 25l6.4-2.6z" fill="#FFC94A" />
          <path className={`${s.twinkle} ${s.twinkle2}`} d="M92 46l1.6 3.9 3.9 1.6-3.9 1.6L92 57l-1.6-3.9-3.9-1.6 3.9-1.6z" fill="#FFC94A" />
        </svg>
      ) : (
        <svg viewBox="0 0 100 100">
          <defs>
            <radialGradient id="sun" cx="0.38" cy="0.32" r="0.75">
              <stop offset="0" stopColor="#FFE38F" />
              <stop offset="1" stopColor="#FFB52E" />
            </radialGradient>
          </defs>
          <g className={s.rays} stroke="#FFC23D" strokeWidth="6" strokeLinecap="round">
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1="50" y1="7" x2="50" y2="17" transform={`rotate(${i * 45} 50 50)`} />
            ))}
          </g>
          <circle cx="50" cy="50" r="25" fill="url(#sun)" />
        </svg>
      )}
    </div>
  );
}

// 比分數的遊戲（沒有關卡）顯示最高分；有關卡的顯示玩到第幾關和累積總分
const SCORE_ONLY: Partial<Record<GameId, string>> = { hoops: 'hoops.best', bricks: 'bricks.best.v2' };

function GameCard({ game, index }: { game: GameMeta; index: number }) {
  const level = useSavedLevel(game.id);
  const bestKey = SCORE_ONLY[game.id];
  const total = useStoredNumber(bestKey ?? `${game.id}.v2.total`);
  const label = bestKey
    ? total
      ? `最高 ${total.toLocaleString()} 分`
      : '新遊戲'
    : level && level > 1
      ? `第 ${level} 關・${(total ?? 0).toLocaleString()} 分`
      : '新遊戲';
  return (
    <Link
      href={`/${game.id}`}
      transitionTypes={['nav-forward']}
      className={s.card}
      data-theme={game.id}
      style={{ '--i': index } as CSSProperties}
      onClick={() => {
        markFromHome();
        sound.unlock();
        sound.tap();
      }}
    >
      <div className={s.inner}>
      <div className={s.art}>
        {HERO[game.id]}
        <span className={level === null ? `${s.level} ${s.levelHidden}` : s.level}>{label}</span>
      </div>
      <div className={s.body}>
        <div className={s.text}>
          <ViewTransition name={`title-${game.id}`} share="morph" default="none">
            <h2>{game.title}</h2>
          </ViewTransition>
          <p>{game.blurb}</p>
        </div>
        <span className={s.go} aria-hidden="true">
          <PlayIcon />
        </span>
      </div>
      </div>
    </Link>
  );
}
