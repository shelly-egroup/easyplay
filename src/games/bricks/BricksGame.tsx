'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import GameShell from '@/components/GameShell';
import { IntroSheet, Meter, Sheet, usePraise, WinSheet } from '@/components/ui';
import { GAME } from '@/games/registry';
import { burst, shake } from '@/lib/fx';
import { useElementSize, usePageVisible, useTimers } from '@/lib/hooks';
import { useGoHome } from '@/lib/nav';
import { CANDY } from '@/lib/palette';
import { buzz, sound } from '@/lib/sound';
import { saveLevel, useSavedLevel } from '@/lib/store';
import { toast } from '@/lib/toast';
import BricksArt from './BricksArt';
import s from './bricks.module.css';

// 補磚塊：磚塊一排一排從上面往下掉，最下面那排有缺口。
// 點缺口那一欄，就從下面射一塊磚上去補；補滿一整排就消掉。磚塊碰到底就要再試一次。

/* 想調難度改這裡：gaps 每排缺幾格（最少～最多）、drop 每隔幾毫秒往下掉一排、goal 消掉幾排過關 */
type BrickLevel = { gaps: [number, number]; drop: number; goal: number };
const LEVELS: BrickLevel[] = [
  { gaps: [1, 1], drop: 6500, goal: 6 },
  { gaps: [1, 2], drop: 5800, goal: 8 },
  { gaps: [2, 2], drop: 5200, goal: 10 },
  { gaps: [2, 3], drop: 4600, goal: 12 },
  { gaps: [2, 3], drop: 4000, goal: 14 },
  { gaps: [3, 4], drop: 3600, goal: 16 },
];
function levelConfig(n: number): BrickLevel {
  if (n <= LEVELS.length) return LEVELS[n - 1];
  const extra = n - LEVELS.length;
  return { gaps: [3, 4], drop: Math.max(2400, 3600 - extra * 200), goal: Math.min(24, 16 + extra * 2) };
}
const START_ROWS = 3;

type Cell = { id: number; color: number; enter?: 'top' | 'shot'; from?: number };
type Row = { id: number; cells: (Cell | null)[] };
type Ghost = { id: number; color: number; r: number; c: number };
type Phase = 'intro' | 'play' | 'over' | 'win';
type Board = { cols: number; rows: number };

/** 依畫面決定欄數：每格盡量大，直放約 6 欄、橫放最多 10 欄，上下保留約 8 排的空間 */
function boardFor(W: number, H: number): Board {
  if (!W || !H) return { cols: 6, rows: 8 };
  const target = H / 9.5;
  const cols = Math.max(6, Math.min(10, Math.floor(W / target)));
  const S = Math.min(W / cols, H / 9.5);
  return { cols, rows: Math.max(6, Math.floor(H / S) - 1) };
}

export default function BricksGame() {
  const saved = useSavedLevel('bricks');
  const goHome = useGoHome();
  const timers = useTimers();
  const praise = usePraise();
  const visible = usePageVisible();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();

  const [phase, setPhase] = useState<Phase>('intro');
  const [level, setLevel] = useState(1);
  const [board, setBoard] = useState<Board | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [cleared, setCleared] = useState(0);
  const [drops, setDrops] = useState(0);

  const rowsRef = useRef<Row[]>([]);
  const boardRef = useRef<Board | null>(null);
  const levelRef = useRef(1);
  const phaseRef = useRef<Phase>('intro');
  const clearedRef = useRef(0);
  const nextId = useRef(1);
  const colorTurn = useRef(0);
  const misses = useRef(0);
  const gridEl = useRef<HTMLDivElement>(null);

  const shownLevel = phase === 'intro' ? (saved ?? 1) : level;
  const cfg = levelConfig(shownLevel);
  const shown = board ?? boardFor(stage.width, stage.height);
  const S = Math.floor(Math.max(36, Math.min(stage.width / shown.cols, stage.height / (shown.rows + 1))));

  const commit = useCallback((next: Row[]) => {
    rowsRef.current = next;
    setRows(next);
  }, []);
  const goPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const makeRow = (b: Board, c: BrickLevel, enter?: 'top'): Row => {
    const [lo, hi] = c.gaps;
    const gaps = Math.min(b.cols - 1, lo + Math.floor(Math.random() * (hi - lo + 1)));
    const holes = new Set<number>();
    while (holes.size < gaps) holes.add(Math.floor(Math.random() * b.cols));
    const color = colorTurn.current++ % CANDY.length;
    return { id: nextId.current++, cells: Array.from({ length: b.cols }, (_, i) => (holes.has(i) ? null : { id: nextId.current++, color, enter })) };
  };

  const start = (n: number) => {
    timers.clear();
    const b = boardFor(stage.width, stage.height);
    boardRef.current = b;
    setBoard(b);
    const c = levelConfig(n);
    levelRef.current = n;
    setLevel(n);
    saveLevel('bricks', n);
    clearedRef.current = 0;
    setCleared(0);
    setDrops(0);
    setGhosts([]);
    misses.current = 0;
    commit(Array.from({ length: START_ROWS }, () => makeRow(b, c, 'top')));
    goPhase('play');
  };

  // 每隔一段時間，整疊往下掉一排，上面補一排新的
  useEffect(() => {
    if (phase !== 'play' || !visible) return;
    const c = levelConfig(levelRef.current);
    const id = setInterval(() => {
      const b = boardRef.current;
      if (!b || phaseRef.current !== 'play') return;
      const next = [makeRow(b, c, 'top'), ...rowsRef.current];
      commit(next);
      setDrops((d) => d + 1);
      sound.drop();
      if (next.length > b.rows) {
        phaseRef.current = 'over';
        buzz([40, 60, 40]);
        timers.after(500, () => goPhase('over'));
      } else if (next.length >= b.rows - 1) {
        toast('磚塊快碰到底了，加油！', 2400);
      }
    }, c.drop);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在進入遊戲／暫停時重設
  }, [phase, visible, level]);

  // 檢查有沒有補滿的排：消掉，下面的往上靠
  const clearRows = () => {
    const full = rowsRef.current.map((row, r) => ({ row, r })).filter(({ row }) => row.cells.every(Boolean));
    if (!full.length) return;
    const gone: Ghost[] = full.flatMap(({ row, r }) => row.cells.map((cell, c) => ({ id: cell!.id, color: cell!.color, r, c })));
    setGhosts((g) => [...g, ...gone]);
    timers.after(420, () => setGhosts((g) => g.filter((x) => !gone.some((y) => y.id === x.id))));
    const ids = new Set(full.map(({ row }) => row.id));
    commit(rowsRef.current.filter((row) => !ids.has(row.id)));
    const rect = gridEl.current?.getBoundingClientRect();
    if (rect) for (const { r } of full) burst(rect.left + rect.width / 2, rect.top + (r + 0.5) * S, CANDY[full[0].row.cells[0]!.color].base, 18, rect.width * 0.4);
    sound.clear(full.length);
    buzz(full.length > 1 ? [20, 30, 20] : 20);
    if (full.length > 1) praise.show(`一次 ${full.length} 排！`);
    clearedRef.current += full.length;
    setCleared(clearedRef.current);
    if (clearedRef.current >= levelConfig(levelRef.current).goal) {
      phaseRef.current = 'win';
      timers.after(700, () => {
        saveLevel('bricks', levelRef.current + 1);
        goPhase('win');
      });
    }
  };

  // 點一欄：磚塊從下面射上去，停在第一塊磚的正下方（就是缺口）
  const shoot = (e: PointerEvent<HTMLDivElement>) => {
    const b = boardRef.current;
    if (!e.isPrimary || e.button > 0 || !b || phaseRef.current !== 'play' || !gridEl.current) return;
    sound.unlock();
    const rect = gridEl.current.getBoundingClientRect();
    const c = Math.min(b.cols - 1, Math.max(0, Math.floor((e.clientX - rect.left) / S)));
    const list = rowsRef.current;
    if (!list.length) return;
    const bottom = list.length - 1;
    if (list[bottom].cells[c]) {
      shake(gridEl.current.querySelector(`[data-launch="${c}"]`));
      sound.nope();
      if (++misses.current >= 2) {
        misses.current = 0;
        toast(
          <>
            請點 <b>最下面那排有缺口</b> 的地方
          </>
        );
      }
      return;
    }
    misses.current = 0;
    let target = bottom;
    while (target > 0 && !list[target - 1].cells[c]) target--;
    const color = list[target].cells.find(Boolean)?.color ?? list[bottom].cells.find(Boolean)?.color ?? 0;
    const cell: Cell = { id: nextId.current++, color, enter: 'shot', from: b.rows - target };
    commit(list.map((row, r) => (r === target ? { ...row, cells: row.cells.map((x, i) => (i === c ? cell : x)) } : row)));
    sound.place();
    buzz(8);
    timers.after(200, clearRows);
  };

  const animateIn = (el: HTMLElement | null, cell: Cell) => {
    if (!el || !cell.enter || el.dataset.done) return;
    el.dataset.done = '1';
    const from = cell.enter === 'shot' ? `translateY(${(cell.from ?? 1) * 100}%)` : 'translateY(-100%)';
    el.animate([{ transform: from, opacity: cell.enter === 'top' ? 0 : 1 }, { transform: 'translateY(0)', opacity: 1 }], {
      duration: cell.enter === 'shot' ? 200 : 500,
      easing: cell.enter === 'shot' ? 'cubic-bezier(.2,.7,.3,1)' : 'cubic-bezier(.3,1.3,.5,1)',
    });
  };

  const bottomRow = rows.length - 1;
  const danger = phase === 'play' && rows.length >= shown.rows - 1;
  const width = shown.cols * S;
  const height = (shown.rows + 1) * S;
  const nextCfg = levelConfig(level + 1);

  return (
    <GameShell
      game={GAME.bricks}
      level={shownLevel}
      stageRef={stageRef}
      hud={
        <Meter value={Math.min(cleared, cfg.goal)} max={cfg.goal}>
          消了 <b key={cleared}>{Math.min(cleared, cfg.goal)}</b>
          <span>/ {cfg.goal} 排</span>
        </Meter>
      }
    >
      <div className={danger ? `${s.board} ${s.danger}` : s.board} style={{ visibility: stage.width ? 'visible' : 'hidden' }} onPointerDown={shoot}>
        <div ref={gridEl} className={s.grid} style={{ width, height, '--s': `${S}px` } as CSSProperties}>
          {phase === 'play' && <i key={drops} className={s.dropTimer} style={{ animationDuration: `${levelConfig(level).drop}ms` }} />}
          {rows.flatMap((row, r) =>
            row.cells.map((cell, c) =>
              cell ? (
                <div key={cell.id} className={s.cell} style={{ transform: `translate3d(${c * S}px,${r * S}px,0)` }}>
                  <span
                    className={s.brick}
                    ref={(el) => animateIn(el, cell)}
                    style={{ '--c': CANDY[cell.color].base, '--c-hi': CANDY[cell.color].hi, '--c-lo': CANDY[cell.color].lo } as CSSProperties}
                  />
                </div>
              ) : (
                <div key={`${row.id}-${c}`} className={r === bottomRow ? `${s.cell} ${s.hole} ${s.need}` : `${s.cell} ${s.hole}`} style={{ transform: `translate3d(${c * S}px,${r * S}px,0)` }} />
              )
            )
          )}
          {ghosts.map((g) => (
            <div key={`g${g.id}`} className={`${s.cell} ${s.gone}`} style={{ transform: `translate3d(${g.c * S}px,${g.r * S}px,0)` }}>
              <span className={s.brick} style={{ '--c': CANDY[g.color].base, '--c-hi': CANDY[g.color].hi, '--c-lo': CANDY[g.color].lo } as CSSProperties} />
            </div>
          ))}
          <div className={s.launchers} style={{ top: shown.rows * S, height: S }}>
            {Array.from({ length: shown.cols }, (_, c) => (
              <span key={c} data-launch={c} className={rows.length && !rows[bottomRow].cells[c] ? `${s.launch} ${s.launchOn}` : s.launch} />
            ))}
          </div>
        </div>
      </div>
      {praise.node}

      <IntroSheet
        open={phase === 'intro'}
        title={GAME.bricks.title}
        art={<BricksArt />}
        text={
          <>
            磚塊會一排一排往下掉。點 <b>最下面那排的缺口</b>，
            <br />
            磚塊就會補上去，補滿一整排就消掉！
          </>
        }
        say="磚塊會一排一排往下掉。點最下面那一排有缺口的地方，磚塊就會從下面補上去。補滿一整排就會消掉。不要讓磚塊碰到底喔。"
        level={saved ?? 1}
        onStart={start}
      />
      <Sheet open={phase === 'over'} label="磚塊碰到底了">
        <div className="sheet__hero" aria-hidden="true">
          <div className="demo-tray">
            <BricksArt still />
          </div>
        </div>
        <div className="sheet__body">
          <h2 className="sheet__title">差一點點！</h2>
          <p className="sheet__text">
            磚塊碰到底了。這一關消了 <b>{cleared}</b> 排，
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
      <WinSheet
        open={phase === 'win'}
        level={level}
        note={nextCfg.gaps[1] > cfg.gaps[1] ? '下一關的缺口會多一點' : '下一關磚塊掉得快一點'}
        onNext={() => start(level + 1)}
        onRestart={() => start(1)}
        onHome={goHome}
      />
    </GameShell>
  );
}
