// 消消樂規則（全部消完版）：
// 點一下「連在一起、一樣顏色」兩個以上就消掉 → 上面的往下掉 → 空掉的那一排往左靠。
// 把整個盤面清空就過關；最後剩幾顆消不掉的，會自動幫忙收掉，不會卡關。

export type Tile = {
  id: number;
  color: number;
  r: number;
  c: number;
  /** 正在消失的動畫中（已不在盤面上） */
  gone?: boolean;
  /** 開局時從上面幾列掉進來 */
  enter?: number;
  delay?: number;
  hint?: boolean;
};

export type Board = { cols: number; rows: number; colors: number };

/* 想調難度改這裡：colors 幾種顏色、tiles 大約幾顆（盤面會依螢幕方向自動排成最大的格子） */
export const LEVELS = [
  { colors: 2, tiles: 30 },
  { colors: 3, tiles: 30 },
  { colors: 3, tiles: 40 },
  { colors: 3, tiles: 48 },
  { colors: 4, tiles: 40 },
  { colors: 4, tiles: 48 },
];

export function levelConfig(n: number) {
  return LEVELS[Math.min(LEVELS.length, Math.max(1, n)) - 1];
}

/** 格子可以稍微拉長或壓扁來填滿畫面，但不會變成長條 */
export const CELL_RATIO = { min: 0.8, max: 1.3 };

export function cellSize(b: Board, W: number, H: number) {
  let sx = W / b.cols;
  let sy = H / b.rows;
  if (sx / sy > CELL_RATIO.max) sx = sy * CELL_RATIO.max;
  else if (sx / sy < CELL_RATIO.min) sy = sx / CELL_RATIO.min;
  return { sx: Math.floor(Math.max(36, sx)), sy: Math.floor(Math.max(36, sy)) };
}

/** 依可用空間決定幾欄幾列，讓方塊盡量大、盡量填滿（滿版） */
export function boardFor(n: number, W: number, H: number): Board {
  const { colors, tiles } = levelConfig(n);
  let best = { cols: 5, rows: 6, area: 0 };
  for (let cols = 4; cols <= 10; cols++) {
    const rows = Math.round(tiles / cols);
    if (rows < 3 || rows > 10 || Math.abs(cols * rows - tiles) > tiles * 0.2) continue;
    const { sx, sy } = cellSize({ cols, rows, colors }, W, H);
    const area = sx * sy * cols * rows;
    if (area > best.area * 1.01) best = { cols, rows, area };
  }
  return { cols: best.cols, rows: best.rows, colors };
}

/* ---------- 解題：確認一盤「可以全部消完」，也拿來給提示 ----------
   盤面一律是「由下往上疊、由左往右靠」，所以用一欄一欄的顏色陣列表示（每欄由下往上） */
type Cols = number[][];
type Move = { c: number; h: number; size: number };

function toCols(tiles: Tile[], b: Board): Cols {
  const cols: Cols = Array.from({ length: b.cols }, () => []);
  const alive = tiles.filter((t) => !t.gone).sort((a, z) => z.r - a.r);
  for (const t of alive) cols[t.c].push(t.color);
  return cols.filter((c) => c.length);
}

function groups(cols: Cols): { cells: [number, number][]; color: number }[] {
  const seen = cols.map((c) => c.map(() => false));
  const out: { cells: [number, number][]; color: number }[] = [];
  for (let c = 0; c < cols.length; c++) {
    for (let h = 0; h < cols[c].length; h++) {
      if (seen[c][h]) continue;
      const color = cols[c][h];
      const cells: [number, number][] = [];
      const stack: [number, number][] = [[c, h]];
      seen[c][h] = true;
      while (stack.length) {
        const [x, y] = stack.pop()!;
        cells.push([x, y]);
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]) {
          if (cols[nx]?.[ny] === color && !seen[nx][ny]) {
            seen[nx][ny] = true;
            stack.push([nx, ny]);
          }
        }
      }
      if (cells.length >= 2) out.push({ cells, color });
    }
  }
  return out;
}

function applyMove(cols: Cols, cells: [number, number][]): Cols {
  const drop = cols.map(() => new Set<number>());
  for (const [c, h] of cells) drop[c].add(h);
  return cols.map((col, c) => col.filter((_, h) => !drop[c].has(h))).filter((col) => col.length);
}

/** 消不掉的孤單方塊數（越少越好，用來排序要先試哪一步） */
function loners(cols: Cols) {
  let n = 0;
  for (let c = 0; c < cols.length; c++) {
    for (let h = 0; h < cols[c].length; h++) {
      const k = cols[c][h];
      if (cols[c + 1]?.[h] !== k && cols[c - 1]?.[h] !== k && cols[c][h + 1] !== k && cols[c][h - 1] !== k) n++;
    }
  }
  return n;
}

/** 找一條能全部消完的路；找不到（或想太久）回傳 null */
function solveCols(start: Cols, budget: number): Move[] | null {
  const seen = new Set<string>();
  let nodes = 0;
  const dfs = (cols: Cols): Move[] | null => {
    if (!cols.length) return [];
    if (++nodes > budget) return null;
    const key = cols.map((c) => c.join('')).join('|');
    if (seen.has(key)) return null;
    seen.add(key);
    const options = groups(cols)
      .map((g) => {
        const next = applyMove(cols, g.cells);
        return { g, next, score: loners(next) * 4 - g.cells.length };
      })
      .sort((a, z) => a.score - z.score);
    for (const o of options) {
      const rest = dfs(o.next);
      if (rest) return [{ c: o.g.cells[0][0], h: o.g.cells[0][1], size: o.g.cells.length }, ...rest];
      if (nodes > budget) return null;
    }
    return null;
  };
  return dfs(start);
}

export function isSolvable(tiles: Tile[], b: Board, budget = 4000) {
  return solveCols(toCols(tiles, b), budget) !== null;
}

/** 照著消就能全部消完的下一群；已經消不完就回傳空陣列 */
export function solutionHint(tiles: Tile[], b: Board, budget = 3000): Tile[] {
  const path = solveCols(toCols(tiles, b), budget);
  if (!path || !path.length) return [];
  const { c, h } = path[0];
  return findGroup(toGrid(tiles, b), b.rows - 1 - h, c);
}

/** 開一盤保證可以全部消完的新盤面 */
export function createSolvableBoard(b: Board, nextId: () => number): Tile[] {
  let tiles = createBoard(b, nextId);
  for (let i = 0; i < 60 && !isSolvable(tiles, b); i++) tiles = createBoard(b, nextId);
  return tiles;
}

/** 螢幕轉向時把盤面轉過來（橫的變直的），再讓方塊重新落定 */
export function transpose(tiles: Tile[], b: Board): { board: Board; tiles: Tile[] } {
  const board = { cols: b.rows, rows: b.cols, colors: b.colors };
  const turned = tiles.filter((t) => !t.gone).map((t) => ({ ...t, r: t.c, c: b.rows - 1 - t.r }));
  return { board, tiles: removeAndSettle(turned, new Set(), board) };
}

type Grid = (Tile | null)[][];

export function toGrid(tiles: Tile[], b: Board): Grid {
  const g: Grid = Array.from({ length: b.rows }, () => Array<Tile | null>(b.cols).fill(null));
  for (const t of tiles) if (!t.gone) g[t.r][t.c] = t;
  return g;
}

const colorAt = (g: Grid, r: number, c: number) => g[r]?.[c]?.color ?? -1;

// 讓同色比較容易聚在一起：比較好找、消起來也比較過癮
function pickColor(g: Grid, r: number, c: number, colors: number) {
  if (Math.random() < 0.42) {
    const near = [colorAt(g, r - 1, c), colorAt(g, r, c - 1)].filter((v) => v >= 0);
    if (near.length) return near[Math.floor(Math.random() * near.length)];
  }
  return Math.floor(Math.random() * colors);
}

export function createBoard(b: Board, nextId: () => number): Tile[] {
  const g = toGrid([], b);
  const tiles: Tile[] = [];
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const t: Tile = { id: nextId(), color: pickColor(g, r, c, b.colors), r, c, enter: b.rows + 1, delay: c * 40 + (b.rows - 1 - r) * 28 };
      g[r][c] = t;
      tiles.push(t);
    }
  }
  if (!hasMoves(g)) tiles[1].color = tiles[0].color;
  return tiles;
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function findGroup(g: Grid, r0: number, c0: number): Tile[] {
  const start = g[r0]?.[c0];
  if (!start) return [];
  const seen = new Set([start.id]);
  const out: Tile[] = [];
  const queue = [start];
  while (queue.length) {
    const t = queue.pop()!;
    out.push(t);
    for (const [dr, dc] of STEPS) {
      const n = g[t.r + dr]?.[t.c + dc];
      if (n && n.color === start.color && !seen.has(n.id)) {
        seen.add(n.id);
        queue.push(n);
      }
    }
  }
  return out;
}

export function hasMoves(g: Grid) {
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < g[r].length; c++) {
      const t = g[r][c];
      if (t && (g[r][c + 1]?.color === t.color || g[r + 1]?.[c]?.color === t.color)) return true;
    }
  }
  return false;
}

/** 最大的一群（提示用） */
export function biggestGroup(g: Grid): Tile[] {
  const seen = new Set<number>();
  let best: Tile[] = [];
  for (const row of g) {
    for (const t of row) {
      if (!t || seen.has(t.id)) continue;
      const group = findGroup(g, t.r, t.c);
      group.forEach((x) => seen.add(x.id));
      if (group.length > best.length) best = group;
    }
  }
  return best.length >= 2 ? best : [];
}

/** 消掉一群：上面的往下掉，空掉的欄往左靠。消掉的先留著播放消失動畫。 */
export function removeAndSettle(tiles: Tile[], removed: Set<number>, b: Board): Tile[] {
  const columns: Tile[][] = Array.from({ length: b.cols }, () => []);
  for (const t of tiles) if (!t.gone && !removed.has(t.id)) columns[t.c].push(t);
  const out: Tile[] = [];
  let col = 0;
  for (const list of columns) {
    if (!list.length) continue;
    list.sort((a, z) => z.r - a.r);
    list.forEach((t, k) => out.push({ ...t, r: b.rows - 1 - k, c: col, enter: undefined, delay: undefined, hint: false }));
    col++;
  }
  for (const t of tiles) {
    if (t.gone) out.push(t);
    else if (removed.has(t.id)) out.push({ ...t, gone: true, hint: false });
  }
  return out;
}
