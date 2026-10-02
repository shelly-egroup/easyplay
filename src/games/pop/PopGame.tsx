'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import GameShell from '@/components/GameShell';
import { TileFace } from '@/components/TileFace';
import { IntroSheet, Meter, Sheet, usePraise, WinSheet } from '@/components/ui';
import { RestartIcon } from '@/components/icons';
import { GAME } from '@/games/registry';
import { burst, floatText, prefersReducedMotion, shake } from '@/lib/fx';
import { useElementSize, useTimers } from '@/lib/hooks';
import { useGoHome } from '@/lib/nav';
import { CANDY } from '@/lib/palette';
import { buzz, sound } from '@/lib/sound';
import { useRunScore, type Banked } from '@/lib/score';
import { saveLevel, useSavedLevel } from '@/lib/store';
import { toast } from '@/lib/toast';
import { boardFor, cellSize, createSolvableBoard, findGroup, hasMoves, levelConfig, removeAndSettle, solutionHint, toGrid, transpose, type Board, type Tile } from './logic';
import PopArt from './PopArt';
import s from './pop.module.css';

// 一次消越多，分數越多（消 n 顆得 n × n × 5 分）；全部消光再加獎勵
// 分數會一關一關累積，所以第一關給分保守、越後面越值錢：
// 每顆 10 × 關卡；一次消越多，每顆加成越多（消 2 顆沒加成，每多 1 顆多 10%）；全部消光再加 100 × 關卡
const pointsFor = (n: number, level: number) => Math.round(n * 10 * level * (1 + 0.1 * Math.max(0, n - 2)));
const clearBonus = (level: number) => 100 * level;

function praiseFor(n: number) {
  if (n >= 16) return '大豐收！';
  if (n >= 11) return '好厲害！';
  if (n >= 7) return '太棒了！';
  return null;
}

type Phase = 'intro' | 'play' | 'stuck' | 'win';
type Point = { x: number; y: number };

const PAD = 10;

export default function PopGame() {
  const saved = useSavedLevel('pop');
  const goHome = useGoHome();
  const timers = useTimers();
  const praise = usePraise();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();

  const [phase, setPhase] = useState<Phase>('intro');
  const [level, setLevel] = useState(1);
  const [board, setBoard] = useState<Board | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const run = useRunScore('pop');
  const [banked, setBanked] = useState<Banked | null>(null);

  // 給事件處理用的最新狀態
  const tilesRef = useRef<Tile[]>([]);
  const boardRef = useRef<Board | null>(null);
  const levelRef = useRef(1);
  const phaseRef = useRef<Phase>('intro');
  const finishing = useRef(false);
  const misses = useRef(0);
  const nextId = useRef(1);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileEls = useRef(new Map<number, HTMLDivElement>());
  const gridRef = useRef<HTMLDivElement>(null);
  const visual = useRef<Map<number, Point> | null>(null);
  const entered = useRef(false);
  const opening = useRef<{ board: Board; tiles: Tile[] } | null>(null);
  const warned = useRef(false);

  const shownLevel = phase === 'intro' ? (saved ?? 1) : level;
  const shownBoard = board ?? boardFor(shownLevel, stage.width - PAD * 2, stage.height - PAD * 2);
  const { sx, sy } = cellSize(shownBoard, stage.width - PAD * 2, stage.height - PAD * 2);

  const commit = useCallback((next: Tile[]) => {
    tilesRef.current = next;
    setTiles(next);
  }, []);
  const goPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // 位置一變就從「畫面上看到的位置」動到新位置；連續點的時候動畫會接著跑，不會跳
  useLayoutEffect(() => {
    const seen = visual.current;
    visual.current = null;
    const reduce = prefersReducedMotion();
    const firstFrame = !entered.current;
    for (const t of tiles) {
      if (t.gone) continue;
      const el = tileEls.current.get(t.id);
      if (!el) continue;
      const to = { x: t.c * sx, y: t.r * sy };
      let from = seen?.get(t.id);
      if (!from && firstFrame && t.enter) from = { x: to.x, y: (t.r - t.enter) * sy };
      if (!from || reduce || (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5)) continue;
      el.getAnimations().forEach((a) => a.cancel());
      const dist = Math.max(Math.abs(from.x - to.x) / sx, Math.abs(from.y - to.y) / sy);
      el.animate([{ transform: `translate3d(${from.x}px,${from.y}px,0)` }, { transform: `translate3d(${to.x}px,${to.y}px,0)` }], {
        duration: 260 + Math.min(dist, 8) * 45,
        delay: firstFrame ? (t.delay ?? 0) : 0,
        easing: 'cubic-bezier(.3,1.3,.55,1)',
        fill: 'backwards',
      });
    }
    if (tiles.length) entered.current = true;
  }, [tiles, sx, sy]);

  const clearHint = () => {
    if (tilesRef.current.some((t) => t.hint)) commit(tilesRef.current.map((t) => (t.hint ? { ...t, hint: false } : t)));
  };
  // 提示「照著消就能全部消完」的那一群；如果已經消不完，就建議重來
  const showHint = () => {
    const b = boardRef.current;
    if (!b || finishing.current) return;
    const best = solutionHint(tilesRef.current, b);
    if (!best.length) {
      if (!warned.current) {
        warned.current = true;
        toast(
          <>
            這一盤可能消不完了，可以按 <b>重來</b> 再試一次
          </>,
          4200
        );
      }
      return;
    }
    const ids = new Set(best.map((t) => t.id));
    commit(tilesRef.current.map((t) => (ids.has(t.id) ? { ...t, hint: true } : t)));
  };
  const armHint = () => {
    timers.cancel(hintTimer.current);
    hintTimer.current = timers.after(levelRef.current === 1 ? 4500 : 7000, showHint);
  };

  // 開新的一盤（保證可以全部消完）；same = 同一盤再試一次
  const start = (n: number, same = false) => {
    timers.clear();
    const genId = () => nextId.current++;
    let b: Board;
    let fresh: Tile[];
    if (same && opening.current) {
      b = opening.current.board;
      fresh = opening.current.tiles.map((t) => ({ ...t, id: genId() }));
    } else {
      b = boardFor(n, stage.width - PAD * 2, stage.height - PAD * 2);
      fresh = createSolvableBoard(b, genId);
      opening.current = { board: b, tiles: fresh };
    }
    boardRef.current = b;
    setBoard(b);
    levelRef.current = n;
    setLevel(n);
    saveLevel('pop', n);
    misses.current = 0;
    run.begin(n);
    setBanked(null);
    warned.current = false;
    finishing.current = false;
    entered.current = false;
    commit(fresh);
    goPhase('play');
    armHint();
  };

  const snapshot = () => {
    const grid = gridRef.current?.getBoundingClientRect();
    if (!grid) return;
    const m = new Map<number, Point>();
    tileEls.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      m.set(id, { x: r.left - grid.left, y: r.top - grid.top });
    });
    visual.current = m;
  };

  // 螢幕轉向（直的變橫的）時，盤面跟著轉過來，永遠撐滿畫面
  const reshape = (w: number, h: number) => {
    const b = boardRef.current;
    if (!b || phaseRef.current !== 'play' || finishing.current || b.cols === b.rows) return;
    if (w >= h === b.cols > b.rows) return;
    snapshot();
    const turned = transpose(tilesRef.current, b);
    boardRef.current = turned.board;
    setBoard(turned.board);
    commit(turned.tiles);
  };

  useEffect(() => {
    reshape(stage.width, stage.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在畫面大小改變時檢查
  }, [stage]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const b = boardRef.current;
    if (!e.isPrimary || e.button > 0 || !b || phaseRef.current !== 'play' || finishing.current) return;
    sound.unlock();

    // 先看手指底下是哪一顆（就算它還在往下掉也算數）；點在縫隙或邊邊就找最近的格子
    const alive = tilesRef.current.filter((t) => !t.gone);
    const grid = toGrid(alive, b);
    const hitEl = (e.target as HTMLElement).closest<HTMLElement>('[data-tile]');
    let hit = hitEl ? alive.find((t) => t.id === Number(hitEl.dataset.tile)) : undefined;
    if (!hit && gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const c = Math.min(b.cols - 1, Math.max(0, Math.floor((e.clientX - rect.left) / sx)));
      const r = Math.min(b.rows - 1, Math.max(0, Math.floor((e.clientY - rect.top) / sy)));
      hit = grid[r][c] ?? undefined;
    }
    if (!hit) return;

    clearHint();
    armHint();
    const group = findGroup(grid, hit.r, hit.c);
    if (group.length < 2) {
      shake(tileEls.current.get(hit.id)?.firstElementChild);
      sound.nope();
      if (++misses.current >= 2) {
        misses.current = 0;
        toast(
          <>
            要找 <b>兩顆以上</b> 一樣顏色、連在一起的喔
          </>
        );
        showHint();
      }
      return;
    }

    misses.current = 0;
    const color = CANDY[hit.color].base;
    let cx = 0;
    let cy = 0;
    group.forEach((t, i) => {
      const r = tileEls.current.get(t.id)?.getBoundingClientRect();
      if (!r) return;
      cx += (r.left + r.width / 2) / group.length;
      cy += (r.top + r.height / 2) / group.length;
      if (i < 16) burst(r.left + r.width / 2, r.top + r.height / 2, color, 5, Math.min(sx, sy) * 0.8);
    });
    const gained = pointsFor(group.length, levelRef.current);
    run.add(gained);
    floatText(cx, cy, `+${gained}`, CANDY[hit.color].lo);
    sound.pop(group.length);
    buzz(group.length >= 10 ? 28 : 12);
    const word = praiseFor(group.length);
    if (word) praise.show(word);

    snapshot();
    const removed = new Set(group.map((t) => t.id));
    const next = removeAndSettle(tilesRef.current, removed, b);
    commit(next);
    timers.after(380, () => commit(tilesRef.current.filter((t) => !removed.has(t.id))));

    // 全部消完才過關；還有剩但沒得消，就請長輩再試一次
    const rest = next.filter((t) => !t.gone);
    if (!rest.length) {
      finishing.current = true;
      timers.cancel(hintTimer.current);
      const bonus = clearBonus(levelRef.current);
      run.add(bonus);
      timers.after(450, () => praise.show(`全部消光 +${bonus}`));
      timers.after(1500, () => {
        setBanked(run.bank());
        saveLevel('pop', levelRef.current + 1);
        goPhase('win');
      });
    } else if (!hasMoves(toGrid(rest, b))) {
      finishing.current = true;
      timers.cancel(hintTimer.current);
      timers.after(900, () => goPhase('stuck'));
    }
  };

  const total = shownBoard.cols * shownBoard.rows;
  const left = phase === 'intro' ? total : tiles.filter((t) => !t.gone).length;
  const next = levelConfig(level + 1);
  const cur = levelConfig(level);
  const note =
    next.colors > cur.colors ? (
      <>
        下一關多一種顏色
        <span className={s.noteTile}>
          <TileFace color={next.colors - 1} />
        </span>
      </>
    ) : next.tiles > cur.tiles ? (
      '下一關的方塊會多一點'
    ) : (
      '下一關換一盤新的'
    );

  return (
    <GameShell
      game={GAME.pop}
      level={shownLevel}
      stageRef={stageRef}
      hud={
        <div className={s.hud}>
          <Meter value={total - left} max={total}>
            還剩 <b key={left}>{left}</b>
            <span>顆</span>
          </Meter>
          <span className={`hud-card ${s.score}`} aria-label={`總分 ${run.total}`}>
            總分 <b key={run.total}>{run.total.toLocaleString()}</b>
          </span>
          <button className="pill" type="button" onClick={() => start(level, true)} disabled={phase !== 'play'} aria-label="這一盤重來">
            <RestartIcon />
            <span className="pill__opt">重來</span>
          </button>
        </div>
      }
    >
      <div className={s.board} style={{ padding: PAD, visibility: stage.width ? 'visible' : 'hidden' }} onPointerDown={onPointerDown}>
        <div
          ref={gridRef}
          className={s.grid}
          style={{ width: shownBoard.cols * sx, height: shownBoard.rows * sy, '--sx': `${sx}px`, '--sy': `${sy}px` } as CSSProperties}
          role="grid"
          aria-label={`消消樂盤面，${shownBoard.colors} 種顏色`}
        >
          {tiles.map((t) => (
            <div
              key={t.id}
              data-tile={t.id}
              ref={(el) => {
                if (el) tileEls.current.set(t.id, el);
                else tileEls.current.delete(t.id);
              }}
              className={[s.tile, t.hint && s.hint, t.gone && s.gone].filter(Boolean).join(' ')}
              style={{ transform: `translate3d(${t.c * sx}px,${t.r * sy}px,0)` }}
              role="gridcell"
              aria-label={CANDY[t.color].name}
            >
              <TileFace color={t.color} />
            </div>
          ))}
        </div>
      </div>
      {praise.node}

      <IntroSheet
        open={phase === 'intro'}
        title={GAME.pop.title}
        art={<PopArt />}
        text={
          <>
            點一下 <b>一樣顏色、連在一起</b> 的方塊，
            <br />
            它們就會消掉。全部消完就過關！
          </>
        }
        say="點一下一樣顏色、連在一起的方塊，它們就會消掉。把全部的方塊消完，就過關了。"
        level={saved ?? 1}
        onStart={start}
      />
      <Sheet open={phase === 'stuck'} label="差一點點">
        <div className="sheet__hero" aria-hidden="true">
          <div className={`demo-tray ${s.leftovers}`}>
            {tiles
              .filter((t) => !t.gone)
              .slice(0, 6)
              .map((t) => (
                <span key={t.id} className={s.leftTile}>
                  <TileFace color={t.color} />
                </span>
              ))}
          </div>
        </div>
        <div className="sheet__body">
          <h2 className="sheet__title">差一點點！</h2>
          <p className="sheet__text">
            還剩 <b>{left}</b> 顆消不掉。
            <br />
            換個順序再試一次，一定可以全部消完！
          </p>
          <div className="sheet__actions">
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => {
                sound.tap();
                start(level, true);
              }}
            >
              同一盤再試一次
            </button>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => {
                sound.tap();
                start(level);
              }}
            >
              換一盤新的方塊
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
        message="全部消光光，太厲害了！"
        points={banked}
        note={note}
        onNext={() => start(level + 1)}
        onRestart={() => start(1)}
        onHome={goHome}
      />
    </GameShell>
  );
}
