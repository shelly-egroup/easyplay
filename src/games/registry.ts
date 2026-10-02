export type GameId = 'pop' | 'memory' | 'numbers' | 'mole';

export type GameMeta = {
  id: GameId;
  title: string;
  /** 首頁卡片上的一句話 */
  blurb: string;
};

export const GAMES: GameMeta[] = [
  { id: 'pop', title: '消消樂', blurb: '一樣的連在一起，點一下就消掉' },
  { id: 'memory', title: '翻牌配對', blurb: '翻兩張牌，找出一樣的一對' },
  { id: 'numbers', title: '數字點點', blurb: '從 1 開始，照順序點下去' },
  { id: 'mole', title: '打地鼠', blurb: '地鼠探出頭來，點一下牠' },
];

export const GAME: Record<GameId, GameMeta> = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameMeta>;
