import { useSyncExternalStore } from 'react';
import { read, write } from './store';

// 所有音效都用 Web Audio 即時合成：像木琴一樣柔和，音域避開長輩較難聽到的高頻
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

type NoteOptions = {
  delay?: number;
  dur?: number;
  vol?: number;
  type?: OscillatorType;
  slide?: number;
  /** [倍頻, 音量, 衰減比例] */
  partials?: [number, number, number][];
};

const MARIMBA: [number, number, number][] = [
  [1, 1, 1],
  [3.98, 0.2, 0.3],
  [2, 0.1, 0.6],
];

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let enabled: boolean | null = null;
const listeners = new Set<() => void>();

function isOn() {
  if (enabled === null) enabled = typeof window === 'undefined' ? true : read('sound', true);
  return enabled;
}

function note(freq: number, o: NoteOptions = {}) {
  if (!isOn() || !ctx || !out) return;
  const t = ctx.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.32, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  for (const [ratio, gain, decay] of o.partials ?? MARIMBA) {
    const osc = ctx.createOscillator();
    const pg = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq * ratio, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(freq * ratio * o.slide, t + dur * 0.8);
    pg.gain.setValueAtTime(gain, t);
    pg.gain.exponentialRampToValueAtTime(0.0001, t + dur * decay);
    osc.connect(pg);
    pg.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

export const sound = {
  get on() {
    return isOn();
  },
  /** 瀏覽器規定要在使用者點擊後才能發聲，每次點擊都呼叫一下 */
  unlock() {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 5;
        out = ctx.createGain();
        out.gain.value = 0.9;
        out.connect(comp);
        comp.connect(ctx.destination);
      } catch {
        ctx = null;
        return;
      }
    }
    if (ctx.state === 'suspended') void ctx.resume();
  },
  toggle() {
    enabled = !isOn();
    write('sound', enabled);
    if (enabled) {
      sound.unlock();
      note(659.25, { dur: 0.3 });
    }
    listeners.forEach((fn) => fn());
  },
  tap() {
    note(783.99, { dur: 0.12, vol: 0.14, partials: [[1, 1, 1]] });
  },
  pop(n: number) {
    const i = Math.min(PENTA.length - 1, 3 + Math.floor(n / 2));
    note(PENTA[i], { dur: 0.5 });
    if (n >= 5) note(PENTA[Math.min(PENTA.length - 1, i + 2)], { delay: 0.07, dur: 0.5, vol: 0.22 });
    if (n >= 9) note(PENTA[Math.min(PENTA.length - 1, i + 4)], { delay: 0.14, dur: 0.6, vol: 0.2 });
  },
  /** 數字點點：每點對一個就往上一個音，點完剛好是一段旋律 */
  step(k: number) {
    const octave = Math.floor((k - 1) / PENTA.length);
    note(PENTA[(k - 1) % PENTA.length] * (octave > 0 ? 2 : 1), { dur: 0.55 });
  },
  good() {
    note(659.25, { dur: 0.4 });
    note(880.0, { delay: 0.1, dur: 0.6 });
  },
  nope() {
    note(220, { dur: 0.22, vol: 0.18, type: 'triangle', slide: 0.82, partials: [[1, 1, 1]] });
  },
  /** 3、2、1 的嗶聲；最後「開始」高一點、長一點 */
  count(final: boolean) {
    note(final ? 783.99 : 523.25, { dur: final ? 0.5 : 0.25, vol: 0.25 });
  },
  flip() {
    note(1046.5, { dur: 0.07, vol: 0.08, partials: [[1, 1, 1]] });
  },
  bonk() {
    note(523.25, { dur: 0.3, vol: 0.34, slide: 0.55, partials: [[1, 1, 1], [2.01, 0.25, 0.4]] });
    note(1318.5, { delay: 0.02, dur: 0.12, vol: 0.1, partials: [[1, 1, 1]] });
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, { delay: i * 0.12, dur: 0.6, vol: 0.26 }));
    [659.25, 783.99, 1046.5].forEach((f) => note(f, { delay: 0.55, dur: 1.2, vol: 0.16 }));
  },
};

export function useSoundOn() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    isOn,
    () => true
  );
}

/** 安卓會輕輕震一下；iOS 不支援就自動略過 */
export function buzz(pattern: number | number[]) {
  if (!isOn() || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // 有些瀏覽器在背景時會拒絕震動
  }
}
