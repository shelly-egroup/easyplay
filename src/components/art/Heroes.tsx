import { useId } from 'react';
import MoleSvg from '@/games/mole/MoleSvg';
import { CANDY } from '@/lib/palette';
import s from './Heroes.module.css';

// 首頁卡片上的插圖：同一套「軟糖」質感（上方光澤、底部厚度、柔和陰影）

const useUid = () => useId().replace(/[^a-zA-Z0-9_-]/g, '');

function CandyDefs({ uid }: { uid: string }) {
  return (
    <>
      {CANDY.map((c, i) => (
        <linearGradient key={i} id={`${uid}-c${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.hi} />
          <stop offset="0.55" stopColor={c.base} />
          <stop offset="1" stopColor={c.lo} />
        </linearGradient>
      ))}
      <radialGradient id={`${uid}-shadow`}>
        <stop offset="0" stopColor="#1d2033" stopOpacity="0.22" />
        <stop offset="1" stopColor="#1d2033" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

function Candy({ uid, x, y, size, rot, color, className }: { uid: string; x: number; y: number; size: number; rot: number; color: number; className?: string }) {
  const h = size / 2;
  const r = size * 0.28;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g className={className}>
        <rect x={-h} y={-h + size * 0.07} width={size} height={size} rx={r} fill={CANDY[color].lo} />
        <rect x={-h} y={-h} width={size} height={size} rx={r} fill={`url(#${uid}-c${color})`} />
        <rect x={-h * 0.7} y={-h * 0.76} width={size * 0.36} height={size * 0.14} rx={size * 0.07} fill="#fff" opacity="0.6" transform={`rotate(-14 ${-h * 0.52} ${-h * 0.69})`} />
      </g>
    </g>
  );
}

function Sparkle({ x, y, r, className, fill = '#fff' }: { x: number; y: number; r: number; className?: string; fill?: string }) {
  return (
    <path
      className={className}
      d={`M${x} ${y - r}C${x + r * 0.15} ${y - r * 0.15} ${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y}C${x + r * 0.15} ${y + r * 0.15} ${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r}C${x - r * 0.15} ${y + r * 0.15} ${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y}C${x - r * 0.15} ${y - r * 0.15} ${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r}z`}
      fill={fill}
    />
  );
}

export function PopHero() {
  const uid = useUid();
  return (
    <svg className={s.hero} viewBox="0 0 320 210" aria-hidden="true">
      <defs>
        <CandyDefs uid={uid} />
      </defs>
      <ellipse cx="168" cy="190" rx="112" ry="12" fill={`url(#${uid}-shadow)`} />
      <Candy uid={uid} x={112} y={118} size={96} rot={-12} color={0} className={s.bobA} />
      <Candy uid={uid} x={204} y={92} size={80} rot={11} color={1} className={s.bobB} />
      <Candy uid={uid} x={186} y={158} size={60} rot={-5} color={2} className={s.bobC} />
      <Candy uid={uid} x={262} y={150} size={38} rot={20} color={3} className={s.popOut} />
      <g className={s.burstRing} stroke={CANDY[3].base} strokeWidth="5" strokeLinecap="round">
        <path d="M262 112v-10M290 124l7-7M298 152h10M234 124l-7-7" />
      </g>
      <Sparkle x={58} y={58} r={11} className={s.twinkleA} />
      <Sparkle x={282} y={46} r={8} className={s.twinkleB} />
      <circle cx="44" cy="150" r="5" fill="#fff" opacity="0.8" className={s.twinkleB} />
    </svg>
  );
}

export function MemoryHero() {
  const uid = useUid();
  return (
    <svg className={s.hero} viewBox="0 0 320 210" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-back`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#7EBBFF" />
          <stop offset="0.55" stopColor="#4A9BF6" />
          <stop offset="1" stopColor="#2C77D8" />
        </linearGradient>
        <linearGradient id={`${uid}-apple`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#FF8C7E" />
          <stop offset="0.6" stopColor="#F2554A" />
          <stop offset="1" stopColor="#D23B33" />
        </linearGradient>
        <pattern id={`${uid}-dots`} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.4" fill="#fff" opacity="0.25" />
        </pattern>
        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0" stopColor="#1d2033" stopOpacity="0.22" />
          <stop offset="1" stopColor="#1d2033" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="166" cy="192" rx="100" ry="11" fill={`url(#${uid}-shadow)`} />
      <g transform="translate(124 106) rotate(-13)">
        <g className={s.bobB}>
          <rect x="-46" y="-60" width="92" height="124" rx="16" fill="#2160B8" />
          <rect x="-46" y="-64" width="92" height="124" rx="16" fill={`url(#${uid}-back)`} />
          <rect x="-38" y="-56" width="76" height="108" rx="11" fill={`url(#${uid}-dots)`} stroke="#fff" strokeOpacity="0.55" strokeWidth="2" />
          <circle cx="0" cy="-2" r="20" fill="#fff" fillOpacity="0.22" stroke="#fff" strokeOpacity="0.6" strokeWidth="3" />
          <text x="0" y="9" textAnchor="middle" className={s.q}>
            ?
          </text>
        </g>
      </g>
      <g transform="translate(200 100) rotate(10)">
        <g className={s.bobA}>
          <rect x="-46" y="-60" width="92" height="124" rx="16" fill="#E3DDD3" />
          <rect x="-46" y="-64" width="92" height="124" rx="16" fill="#fff" />
          <circle cx="0" cy="-6" r="32" fill="#FFE3DD" />
          <g transform="translate(-27 -36) scale(0.54)">
            <path d="M50 30C38 22 16 24 14 46c-2 22 16 46 28 46 5 0 6-3 8-3s3 3 8 3c12 0 30-24 28-46-2-22-24-24-36-16z" fill={`url(#${uid}-apple)`} />
            <ellipse cx="31" cy="47" rx="7" ry="11" fill="#fff" opacity="0.5" transform="rotate(20 31 47)" />
            <path d="M50 31c0-8 2-14 6-19" stroke="#7A4A2A" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M55 21c7-11 20-12 25-8-6 10-17 12-25 8z" fill="#36C178" />
          </g>
          <rect x="-22" y="36" width="44" height="9" rx="4.5" fill="#EDE8E0" />
        </g>
      </g>
      <Sparkle x={262} y={48} r={11} className={s.twinkleA} />
      <Sparkle x={58} y={50} r={8} className={s.twinkleB} />
      <circle cx="276" cy="160" r="5" fill="#fff" opacity="0.8" className={s.twinkleA} />
    </svg>
  );
}

function Block({ x, y, rot, n, done, className }: { x: number; y: number; rot: number; n: number; done?: boolean; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g className={className}>
        <rect x="-38" y="-33" width="76" height="76" rx="22" fill={done ? '#159E71' : '#E4DED3'} />
        <rect x="-38" y="-38" width="76" height="76" rx="22" fill={done ? '#2DC491' : '#fff'} />
        <text x="0" y="16" textAnchor="middle" className={s.num} fill={done ? '#fff' : '#1d2033'}>
          {n}
        </text>
        {done && (
          <g transform="translate(28 -30)">
            <circle r="13" fill="#fff" />
            <path d="M-6 0l4 4 8-8" fill="none" stroke="#2DC491" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </g>
    </g>
  );
}

export function NumbersHero() {
  const uid = useUid();
  return (
    <svg className={s.hero} viewBox="0 0 320 210" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-shadow`}>
          <stop offset="0" stopColor="#1d2033" stopOpacity="0.2" />
          <stop offset="1" stopColor="#1d2033" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="164" cy="190" rx="118" ry="11" fill={`url(#${uid}-shadow)`} />
      <Block x={84} y={128} rot={-9} n={1} done className={s.bobA} />
      <g className={s.ring}>
        <circle cx="164" cy="92" r="50" fill="none" stroke="#fff" strokeWidth="5" />
      </g>
      <Block x={164} y={92} rot={3} n={2} className={s.bobB} />
      <Block x={244} y={132} rot={10} n={3} className={s.bobC} />
      <Sparkle x={52} y={50} r={10} className={s.twinkleA} />
      <Sparkle x={278} y={52} r={8} className={s.twinkleB} />
    </svg>
  );
}

export function MoleHero() {
  const uid = useUid();
  return (
    <svg className={s.hero} viewBox="0 0 320 210" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-dirt`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C68F62" />
          <stop offset="1" stopColor="#94603C" />
        </linearGradient>
        <linearGradient id={`${uid}-head`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF9D8E" />
          <stop offset="0.6" stopColor="#FF6F61" />
          <stop offset="1" stopColor="#E0473C" />
        </linearGradient>
        <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E9B57E" />
          <stop offset="1" stopColor="#C58A52" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x="90" y="0" width="140" height="162" />
        </clipPath>
      </defs>
      <ellipse cx="160" cy="162" rx="84" ry="22" fill="#3A2719" />
      <g clipPath={`url(#${uid}-clip)`}>
        <g className={s.peek}>
          <MoleSvg x={103} y={38} width={114} />
        </g>
      </g>
      <path d="M74 162a86 24 0 0 0 172 0v4a86 26 0 0 1-172 0z" fill={`url(#${uid}-dirt)`} />
      <path d="M74 162a86 24 0 0 0 172 0" fill="none" stroke="#D9A476" strokeWidth="5" strokeLinecap="round" />
      <g transform="translate(262 70)">
        <g className={s.swing}>
          <rect x="-6" y="-6" width="12" height="70" rx="6" fill={`url(#${uid}-wood)`} transform="rotate(32)" />
          <g transform="rotate(32)">
            <rect x="-30" y="-30" width="60" height="34" rx="14" fill="#C23A30" />
            <rect x="-30" y="-34" width="60" height="34" rx="14" fill={`url(#${uid}-head)`} />
            <rect x="-22" y="-34" width="6" height="34" fill="#fff" opacity="0.7" />
            <rect x="16" y="-34" width="6" height="34" fill="#fff" opacity="0.7" />
          </g>
        </g>
      </g>
      <path d="M40 182c3-12 6-20-2-30 10 5 13 16 14 30M52 182c0-14 2-24 5-34 4 11 5 22 4 34" fill="#5DAA45" />
      <path d="M272 186c2-10 6-17 14-21-6 7-7 13-7 21" fill="#5DAA45" />
      <Sparkle x={60} y={52} r={10} className={s.twinkleA} />
    </svg>
  );
}
