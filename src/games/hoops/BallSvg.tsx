import { useId } from 'react';

// 籃球：橘色漸層＋深色球線
export default function BallSvg({ className }: { className?: string }) {
  const id = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-ball`;
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFB26B" />
          <stop offset="0.55" stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#D65A12" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill={`url(#${id})`} />
      <g fill="none" stroke="#7A3410" strokeWidth="3.4" strokeLinecap="round" opacity="0.85">
        <path d="M50 3v94M3 50h94" />
        <path d="M18 14c12 10 18 22 18 36s-6 26-18 36" />
        <path d="M82 14c-12 10-18 22-18 36s6 26 18 36" />
      </g>
      <ellipse cx="34" cy="27" rx="13" ry="7" fill="#fff" opacity="0.35" transform="rotate(-28 34 27)" />
    </svg>
  );
}
