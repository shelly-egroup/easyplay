'use client';

import { useEffect, ViewTransition, type ReactNode, type Ref } from 'react';
import type { GameMeta } from '@/games/registry';
import { useWakeLock } from '@/lib/hooks';
import { useGoHome } from '@/lib/nav';
import { sound, useSoundOn } from '@/lib/sound';
import { hush } from '@/lib/speech';
import { clearToast } from '@/lib/toast';
import { HomeIcon, SoundOffIcon, SoundOnIcon } from './icons';

// 每個遊戲共用的滿版外框：一條上方列（首頁、名稱、關卡、進度、聲音），其餘全部給遊戲區
export default function GameShell({
  game,
  level,
  badge,
  hud,
  stageRef,
  children,
}: {
  game: GameMeta;
  /** 沒有關卡的遊戲不用傳，改用 badge（例如「最高 56 分」） */
  level?: number;
  badge?: ReactNode;
  hud?: ReactNode;
  stageRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const goHome = useGoHome();
  const soundOn = useSoundOn();
  useWakeLock(true);
  useEffect(
    () => () => {
      hush();
      clearToast();
    },
    []
  );

  return (
    <section className="game mesh" data-theme={game.id}>
      <header className="bar">
        <button className="pill" type="button" onClick={goHome}>
          <HomeIcon />
          <span>首頁</span>
        </button>
        <div className="bar__title">
          <ViewTransition name={`title-${game.id}`} share="morph" default="none">
            <h1>{game.title}</h1>
          </ViewTransition>
          {level !== undefined ? (
            <span key={level} className="chip">
              第 {level} 關
            </span>
          ) : (
            badge && <span className="chip">{badge}</span>
          )}
        </div>
        <div className="bar__hud">{hud}</div>
        <button
          className="pill pill--icon"
          type="button"
          onClick={() => sound.toggle()}
          aria-label={soundOn ? '聲音開著，點一下關掉' : '聲音關著，點一下打開'}
        >
          {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
        </button>
      </header>
      <div className="stage" ref={stageRef}>
        {children}
      </div>
    </section>
  );
}
