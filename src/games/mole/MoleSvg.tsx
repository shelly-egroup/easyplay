import { useId } from 'react';
import s from './mole.module.css';

const BODY = {
  brown: ['#9C6744', '#8A5636', '#6F4127', '#74472C', '#EBC59D'],
  gold: ['#FFE07A', '#FFC531', '#E59A00', '#E9A40E', '#FFF1C4'],
};

// 可愛的地鼠：被點到時會變成「＞＜」的表情；金色地鼠打到加 2 分
export default function MoleSvg({ className, x, y, width, gold }: { className?: string; x?: number; y?: number; width?: number; gold?: boolean }) {
  const body = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-body`;
  const [c1, c2, c3, ear, muzzle] = BODY[gold ? 'gold' : 'brown'];
  return (
    <svg className={className} x={x} y={y} width={width} height={width === undefined ? undefined : (width * 130) / 120} viewBox="0 0 120 130" aria-hidden="true">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor={c1} />
          <stop offset="0.55" stopColor={c2} />
          <stop offset="1" stopColor={c3} />
        </linearGradient>
      </defs>
      <circle cx="29" cy="30" r="11" fill={ear} />
      <circle cx="91" cy="30" r="11" fill={ear} />
      <circle cx="29" cy="30" r="5.5" fill="#E9A3A0" />
      <circle cx="91" cy="30" r="5.5" fill="#E9A3A0" />
      <path d="M13 132V68C13 36 34 13 60 13s47 23 47 55v64z" fill={`url(#${body})`} />
      <path d="M33 33c7-8 17-12 28-12" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="6" strokeLinecap="round" />
      {gold && <path d="M86 24l2.4 5.6 5.6 2.4-5.6 2.4L86 40l-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#fff" className={s.glint} />}
      <ellipse cx="60" cy="76" rx="27" ry="20" fill={muzzle} />
      <g className={s.eyes}>
        <circle cx="43" cy="55" r="6.4" fill="#2B1B12" />
        <circle cx="77" cy="55" r="6.4" fill="#2B1B12" />
        <circle cx="45.2" cy="52.6" r="2.3" fill="#fff" />
        <circle cx="79.2" cy="52.6" r="2.3" fill="#fff" />
      </g>
      <g className={s.eyesHit} fill="none" stroke="#2B1B12" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M37 50l9 5-9 5M83 50l-9 5 9 5" />
      </g>
      <ellipse cx="32" cy="71" rx="7" ry="4.5" fill="#F59BA2" opacity=".65" />
      <ellipse cx="88" cy="71" rx="7" ry="4.5" fill="#F59BA2" opacity=".65" />
      <ellipse cx="60" cy="68" rx="9" ry="6.8" fill="#EF7C8E" />
      <ellipse cx="57.2" cy="65.8" rx="2.6" ry="1.7" fill="#fff" opacity=".75" />
      <path d="M51 79q9 7 18 0" fill="none" stroke="#6B4028" strokeWidth="3" strokeLinecap="round" />
      <rect x="55.5" y="80.5" width="9" height="8.5" rx="2" fill="#fff" stroke="#E2D6CA" strokeWidth="1" />
      <path d="M60 80.5v8.5" stroke="#E2D6CA" strokeWidth="1" />
      <g fill={muzzle}>
        <ellipse cx="33" cy="106" rx="14" ry="9.5" />
        <ellipse cx="87" cy="106" rx="14" ry="9.5" />
      </g>
      <g stroke={gold ? '#D9A200' : '#C79C74'} strokeWidth="2" strokeLinecap="round">
        <path d="M28 101v6M34 100v7M40 101v6M80 101v6M86 100v7M92 101v6" />
      </g>
    </svg>
  );
}

// 小白兔：不能打！打到會難過、扣一分
export function BunnySvg() {
  const id = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-fur`;
  return (
    <svg viewBox="0 0 120 130" aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E9E3EE" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`} stroke="#DDD4E4" strokeWidth="2">
        <ellipse cx="40" cy="-4" rx="12" ry="34" transform="rotate(-8 40 -4)" />
        <ellipse cx="80" cy="-4" rx="12" ry="34" transform="rotate(8 80 -4)" />
      </g>
      <ellipse cx="40" cy="-2" rx="5.5" ry="24" fill="#FFC6D3" transform="rotate(-8 40 -2)" />
      <ellipse cx="80" cy="-2" rx="5.5" ry="24" fill="#FFC6D3" transform="rotate(8 80 -2)" />
      <path d="M13 132V68C13 36 34 18 60 18s47 18 47 50v64z" fill={`url(#${id})`} stroke="#DDD4E4" strokeWidth="2" />
      <g className={s.eyes}>
        <circle cx="44" cy="58" r="6" fill="#3A2A44" />
        <circle cx="76" cy="58" r="6" fill="#3A2A44" />
        <circle cx="46" cy="55.8" r="2.2" fill="#fff" />
        <circle cx="78" cy="55.8" r="2.2" fill="#fff" />
      </g>
      <g className={s.eyesHit}>
        <path d="M37 58q7-5 14 0M69 58q7-5 14 0" fill="none" stroke="#3A2A44" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M43 62q-3 6 0 9 3-3 0-9zM77 62q-3 6 0 9 3-3 0-9z" fill="#7CC4FF" />
      </g>
      <ellipse cx="32" cy="72" rx="7" ry="4.5" fill="#FFB3C4" opacity=".7" />
      <ellipse cx="88" cy="72" rx="7" ry="4.5" fill="#FFB3C4" opacity=".7" />
      <path d="M55 69h10l-5 5z" fill="#FF8FA8" strokeLinejoin="round" stroke="#FF8FA8" strokeWidth="2" />
      <path d="M60 74v4M60 78q-5 5-9 1M60 78q5 5 9 1" fill="none" stroke="#9C7A8E" strokeWidth="2.4" strokeLinecap="round" />
      <g fill="#fff" stroke="#DDD4E4" strokeWidth="2">
        <ellipse cx="34" cy="106" rx="13" ry="9" />
        <ellipse cx="86" cy="106" rx="13" ry="9" />
      </g>
    </svg>
  );
}
