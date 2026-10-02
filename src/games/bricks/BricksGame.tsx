'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import GameShell from '@/components/GameShell';
import { IntroSheet, Sheet, usePraise } from '@/components/ui';
import { GAME } from '@/games/registry';
import { burst, floatText, prefersReducedMotion, shake } from '@/lib/fx';
import { useElementSize, usePageVisible, useTimers } from '@/lib/hooks';
import { useGoHome } from '@/lib/nav';
import { CANDY } from '@/lib/palette';
import { buzz, sound } from '@/lib/sound';
import { read, write } from '@/lib/store';
import { toast } from '@/lib/toast';
import BricksArt from './BricksArt';
import s from './bricks.module.css';

// 補磚塊（不分關卡，比分數）：
// 整面磚牆會一直慢慢往下降，最下面那排有缺口。點缺口那一欄，就從下面射一塊磚上去補；補滿一整排就消掉。
// 時間越久，降得越快、缺口越多。磚塊碰到底就結束。

/* 想調難度改這裡：每過 STAGE_SECONDS 秒速度升一級；speed 每秒降幾排；gaps 每排缺幾格（最少～最多） */
const STAGE_SECONDS = 18;
function stageConfig(stage: number, cols: number) {
  const speed = Math.min(0.9, 0.2 + (stage - 1) * 0.06);
  const table: [number, number][] = [
    [1, 2],
    [2, 2],
    [2, 3],
    [2, 3],
    [3, 4],
    [3, 5],
  ];
  const [lo, hi] = table[Math.min(table.length - 1, stage - 1)];
  const cap = Math.max(1, cols - 2);
  return { speed, gaps: [Math.min(lo, cap), Math.min(hi + Math.max(0, stage - 6), cap)] as [number, number] };
}
const START_ROWS = 4;
/** 這麼多秒內接著再消一排，就算「連消」，分數加倍 */
const COMBO_WINDOW = 2.5;

type Cell = { id: number; color: number; shot?: number };
type Row = { id: number; color: number; cells: (Cell | null)[] };
type Ghost = { id: number; color: number; y: number };
type Board = { cols: number; rows: number; cw: number; rh: number };
type Phase = 'intro' | 'play' | 'over';

/** 滿版：寬度剛好排滿，磚塊是橫的長方形；直放約 6 欄、橫放最多 10 欄 */
function boardFor(W: number, H: number): Board {
  if (!W || !H) return { cols: 6, rows: 8, cw: 60, rh: 44 };
  const rhGuess = H / 10;
  const cols = Math.max(6, Math.min(10, Math.floor(W / (rhGuess * 1.55))));
  const cw = W / cols;
  const rh = Math.min(H / 10, cw / 1.15);
  return { cols, rows: Math.max(6, Math.floor(H / rh) - 1), cw, rh };
}

export default function BricksGame() {
  const goHome = useGoHome();
  const timers = useTimers();
  const praise = usePraise();
  const visible = usePageVisible();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();

  const [phase, setPhase] = useState<Phase>('intro');
  const [board, setBoard] = useState<Board | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [best, setBest] = useState(0);
  const [record, setRecord] = useState(false);
  const [danger, setDanger] = useState(false);

  const rowsRef = useRef<Row[]>([]);
  const boardRef = useRef<Board | null>(null);
  const phaseRef = useRef<Phase>('intro');
  const bottom = useRef(START_ROWS);
  const shownY = useRef(new Map<number, number>());
  const rowEls = useRef(new Map<number, HTMLDivElement>());
  const elapsed = useRef(0);
  const stats = useRef({ score: 0, lines: 0, combo: 0, lastClear: -99 });
  const nextId = useRef(1);
  const colorTurn = useRef(0);
  const misses = useRef(0);
  const wellEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setBest(read('bricks.best', 0)), 0);
    return () => clearTimeout(id);
  }, []);

  const shown = board ?? boardFor(stage.width, stage.height);

  const commit = (next: Row[]) => {
    rowsRef.current = next;
    setRows(next);
  };

  const makeRow = (b: Board, stageNo: number): Row => {
    const [lo, hi] = stageConfig(stageNo, b.cols).gaps;
    const gaps = lo + Math.floor(Math.random() * (hi - lo + 1));
    const holes = new Set<number>();
    while (holes.size < gaps) holes.add(Math.floor(Math.random() * b.cols));
    const color = colorTurn.current++ % CANDY.length;
    return { id: nextId.current++, color, cells: Array.from({ length: b.cols }, (_, i) => (holes.has(i) ? null : { id: nextId.current++, color })) };
  };

  const start = () => {
    timers.clear();
    const b = boardFor(stage.width, stage.height);
    boardRef.current = b;
    setBoard(b);
    elapsed.current = 0;
    stats.current = { score: 0, lines: 0, combo: 0, lastClear: -99 };
    setScore(0);
    setLines(0);
    setLevel(1);
    setRecord(false);
    setDanger(false);
    setGhosts([]);
    misses.current = 0;
    bottom.current = START_ROWS;
    shownY.current = new Map();
    commit(Array.from({ length: START_ROWS }, () => makeRow(b, 1)));
    phaseRef.current = 'play';
    setPhase('play');
  };

  const end = () => {
    phaseRef.current = 'over';
    buzz([40, 60, 40]);
    sound.nope();
    const prev = read('bricks.best', 0);
    if (stats.current.score > prev) {
      write('bricks.best', stats.current.score);
      setBest(stats.current.score);
      setRecord(true);
      timers.after(300, () => sound.win());
    }
    timers.after(500, () => setPhase('over'));
  };

  // 主迴圈：整面牆慢慢往下降，越來越快；上面不夠就補新的一排
  useEffect(() => {
    if (phase !== 'play' || !visible) return;
    const reduce = prefersReducedMotion();
    let raf = 0;
    let last = performance.now();
    let warned = false;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const b = boardRef.current;
      if (!b || phaseRef.current !== 'play') return;
      elapsed.current += dt;
      const stageNo = 1 + Math.floor(elapsed.current / STAGE_SECONDS);
      const { speed } = stageConfig(stageNo, b.cols);
      bottom.current += speed * dt;

      let list = rowsRef.current;
      if (bottom.current - list.length > -1) {
        list = [makeRow(b, stageNo), ...list];
        commit(list);
      }
      // 每一排往目標位置靠（消掉一排時，下面的會平順地往上補）
      const n = list.length;
      const k = reduce ? 1 : 1 - Math.exp(-dt * 14);
      list.forEach((row, i) => {
        const target = bottom.current - (n - i);
        const prev = shownY.current.get(row.id) ?? target - 0.6;
        const y = prev + (target - prev) * k;
        shownY.current.set(row.id, y);
        const el = rowEls.current.get(row.id);
        if (el) el.style.transform = `translate3d(0,${y * b.rh}px,0)`;
      });

      const near = bottom.current > b.rows - 1.6;
      setDanger((d) => (d === near ? d : near));
      if (near && !warned) {
        warned = true;
        toast('磚塊快碰到底了，加油！', 2200);
      }
      if (!near) warned = false;
      setLevel((lv) => (lv === stageNo ? lv : stageNo));
      if (bottom.current >= b.rows) {
        end();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在進入遊戲、暫停時重設
  }, [phase, visible]);

  // 補滿的排：消掉，下面的往上靠
  const clearRows = () => {
    const b = boardRef.current;
    if (!b) return;
    const list = rowsRef.current;
    const full = list.filter((row) => row.cells.every(Boolean));
    if (!full.length) return;
    setGhosts((g) => [...g, ...full.map((row) => ({ id: row.id, color: row.color, y: shownY.current.get(row.id) ?? 0 }))]);
    timers.after(460, () => setGhosts((g) => g.filter((x) => !full.some((row) => row.id === x.id))));
    const ids = new Set(full.map((row) => row.id));
    commit(list.filter((row) => !ids.has(row.id)));
    bottom.current -= full.length;

    const stageNo = 1 + Math.floor(elapsed.current / STAGE_SECONDS);
    const st = stats.current;
    st.combo = elapsed.current - st.lastClear <= COMBO_WINDOW ? Math.min(5, st.combo + 1) : 1;
    st.lastClear = elapsed.current;
    const gained = 10 * stageNo * full.length * (full.length > 1 ? 2 : 1) * st.combo;
    stats.current.score += gained;
    stats.current.lines += full.length;
    setScore(stats.current.score);
    setLines(stats.current.lines);
    const rect = wellEl.current?.getBoundingClientRect();
    if (rect) {
      for (const row of full) {
        const y = rect.top + ((shownY.current.get(row.id) ?? 0) + 0.5) * b.rh;
        burst(rect.left + rect.width / 2, y, CANDY[row.color].hi, 20, rect.width * 0.45);
        floatText(rect.left + rect.width / 2, y, `+${gained / full.length}`, '#fff');
      }
    }
    sound.clear(full.length);
    buzz(full.length > 1 ? [20, 30, 20] : 20);
    if (full.length > 1) praise.show(`一次 ${full.length} 排！`);
    else if (st.combo > 1) praise.show(`連消 ×${st.combo}！`);
  };

  // 點一欄：磚塊從下面射上去，停在第一塊磚的正下方（就是缺口）
  const shoot = (e: PointerEvent<HTMLDivElement>) => {
    const b = boardRef.current;
    if (!e.isPrimary || e.button > 0 || !b || phaseRef.current !== 'play' || !wellEl.current) return;
    sound.unlock();
    const rect = wellEl.current.getBoundingClientRect();
    const c = Math.min(b.cols - 1, Math.max(0, Math.floor((e.clientX - rect.left) / b.cw)));
    const list = rowsRef.current;
    const last = list.length - 1;
    if (last < 0) return;
    if (list[last].cells[c]) {
      shake(wellEl.current.querySelector(`[data-launch="${c}"]`));
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
    let target = last;
    while (target > 0 && !list[target - 1].cells[c]) target--;
    const distance = b.rows - (shownY.current.get(list[target].id) ?? 0) - 1;
    const cell: Cell = { id: nextId.current++, color: list[target].color, shot: Math.max(1, distance) };
    commit(list.map((row, r) => (r === target ? { ...row, cells: row.cells.map((x, i) => (i === c ? cell : x)) } : row)));
    sound.place();
    buzz(8);
    timers.after(170, clearRows);
  };

  const flyIn = (el: HTMLElement | null, cell: Cell) => {
    if (!el || !cell.shot || el.dataset.done) return;
    el.dataset.done = '1';
    el.animate([{ transform: `translateY(${cell.shot * 100}%)`, filter: 'brightness(1.6)' }, { transform: 'translateY(0)', filter: 'brightness(1)' }], {
      duration: 170,
      easing: 'cubic-bezier(.2,.7,.3,1)',
    });
  };

  const lastRow = rows[rows.length - 1];
  const W = shown.cols * shown.cw;
  const H = (shown.rows + 1) * shown.rh;

  return (
    <GameShell
      game={GAME.bricks}
      badge={`最高 ${best} 分`}
      stageRef={stageRef}
      hud={
        <div className={s.hud}>
          <span className={`hud-card ${s.score}`}>
            分數 <b key={score}>{score}</b>
          </span>
          <span className={`hud-card ${s.stat}`}>
            消了 <b key={lines}>{lines}</b> 排
          </span>
          <span className={`hud-card ${s.speed}`} key={level}>
            速度 <b>{level}</b>
          </span>
        </div>
      }
    >
      <div
        ref={wellEl}
        className={danger ? `${s.well} ${s.danger}` : s.well}
        style={{ width: W, height: H, '--cw': `${shown.cw}px`, '--rh': `${shown.rh}px`, visibility: stage.width ? 'visible' : 'hidden' } as CSSProperties}
        onPointerDown={shoot}
      >
        <div className={s.lanes} />
        {rows.map((row, r) => (
          <div
            key={row.id}
            className={s.row}
            ref={(el) => {
              if (el) rowEls.current.set(row.id, el);
              else rowEls.current.delete(row.id);
            }}
          >
            {row.cells.map((cell, c) =>
              cell ? (
                <span key={cell.id} className={s.slot}>
                  <span
                    className={s.brick}
                    ref={(el) => flyIn(el, cell)}
                    style={{ '--c': CANDY[cell.color].base, '--c-hi': CANDY[cell.color].hi, '--c-lo': CANDY[cell.color].lo } as CSSProperties}
                  />
                </span>
              ) : (
                <span key={`h${c}`} className={r === rows.length - 1 ? `${s.slot} ${s.hole} ${s.need}` : `${s.slot} ${s.hole}`} />
              )
            )}
          </div>
        ))}
        {ghosts.map((g) => (
          <div key={`g${g.id}`} className={`${s.row} ${s.gone}`} style={{ transform: `translate3d(0,${g.y * shown.rh}px,0)` }}>
            {Array.from({ length: shown.cols }, (_, c) => (
              <span key={c} className={s.slot}>
                <span className={s.brick} style={{ '--c': CANDY[g.color].base, '--c-hi': CANDY[g.color].hi, '--c-lo': CANDY[g.color].lo } as CSSProperties} />
              </span>
            ))}
          </div>
        ))}
        <div className={s.deadline} style={{ top: shown.rows * shown.rh }} />
        <div className={s.launchers} style={{ top: shown.rows * shown.rh, height: shown.rh }}>
          {Array.from({ length: shown.cols }, (_, c) => (
            <span key={c} data-launch={c} className={lastRow && !lastRow.cells[c] ? `${s.launch} ${s.launchOn}` : s.launch}>
              <i />
            </span>
          ))}
        </div>
      </div>
      {praise.node}

      <IntroSheet
        open={phase === 'intro'}
        title={GAME.bricks.title}
        art={<BricksArt />}
        text={
          <>
            磚牆會一直往下降，越來越快！點 <b>最下面那排的缺口</b>，
            <br />
            補滿一整排就消掉，接著馬上再消就是「連消」！
          </>
        }
        say="磚牆會慢慢往下降，而且越來越快、缺口越來越多。點最下面那一排有缺口的地方，磚塊就會從下面補上去，補滿一整排就會消掉。不要讓磚塊碰到底喔。"
        tag={best > 0 ? `最高 ${best} 分` : undefined}
        onStart={start}
      />
      <Sheet open={phase === 'over'} label="磚塊碰到底了" confetti={record}>
        <div className="sheet__hero" aria-hidden="true">
          <BricksArt still />
        </div>
        <div className="sheet__body">
          <p className="win__kicker">{record ? '新紀錄！' : '磚塊碰到底了'}</p>
          <h2 className="sheet__title">{score} 分</h2>
          <p className="sheet__text">
            消了 <b>{lines}</b> 排，撐到速度 <b>{level}</b>。
            <br />
            {record ? '打破最高紀錄，太厲害了！' : `最高紀錄是 ${best} 分，再接再厲！`}
          </p>
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
