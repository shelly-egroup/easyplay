import type { ReactNode } from 'react';

function Stroke({ children, width = 2.4 }: { children: ReactNode; width?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = () => (
  <Stroke>
    <path d="M3.5 11.2 12 4.5l8.5 6.7" />
    <path d="M6 9.5v9.5h4.2v-5.2h3.6V19H18V9.5" />
  </Stroke>
);

export const ArrowIcon = () => (
  <Stroke width={2.8}>
    <path d="M5 12h13.5M13 6.2 18.8 12 13 17.8" />
  </Stroke>
);

export const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7.5 4.8c0-1.2 1.3-1.9 2.3-1.3l10 6.4c1 .6 1 2 0 2.6l-10 6.4c-1 .6-2.3-.1-2.3-1.3z" fill="currentColor" />
  </svg>
);

export const CheckIcon = () => (
  <Stroke width={3.2}>
    <path d="M5 12.6 9.6 17.2 19 7.4" />
  </Stroke>
);

export const SoundOnIcon = () => (
  <Stroke>
    <path d="M4 9.6v4.8h3.4L12 18.3V5.7L7.4 9.6z" fill="currentColor" />
    <path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
  </Stroke>
);

export const SoundOffIcon = () => (
  <Stroke>
    <path d="M4 9.6v4.8h3.4L12 18.3V5.7L7.4 9.6z" fill="currentColor" />
    <path d="m16 9.5 5 5m0-5-5 5" />
  </Stroke>
);

export const EyeIcon = () => (
  <Stroke>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Stroke>
);

export const TalkIcon = () => (
  <Stroke>
    <path d="M5.2 5.2h13.6c.9 0 1.7.8 1.7 1.7v8.2c0 .9-.8 1.7-1.7 1.7H12l-4.6 3.6v-3.6H5.2c-.9 0-1.7-.8-1.7-1.7V6.9c0-.9.8-1.7 1.7-1.7z" />
    <path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth={3} />
  </Stroke>
);

export const ExpandIcon = () => (
  <Stroke>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Stroke>
);

export const ClockIcon = () => (
  <Stroke width={2.6}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4.2l2.8 1.8M9.5 2.8h5" />
  </Stroke>
);

export const RestartIcon = () => (
  <Stroke width={2.6}>
    <path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.3" />
    <path d="M4.4 4.2v4.4h4.4" />
  </Stroke>
);

/** easyplay 標誌：四個不同形狀的方塊 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="3" y="3" width="45" height="45" rx="13" fill="#FF6F61" />
      <rect x="52" y="3" width="45" height="45" rx="13" fill="#4A9BF6" />
      <rect x="3" y="52" width="45" height="45" rx="13" fill="#FFC43D" />
      <rect x="52" y="52" width="45" height="45" rx="13" fill="#2DC491" />
      <g fill="#fff" opacity="0.6">
        <rect x="10" y="9" width="17" height="7" rx="3.5" />
        <rect x="59" y="9" width="17" height="7" rx="3.5" />
        <rect x="10" y="58" width="17" height="7" rx="3.5" />
        <rect x="59" y="58" width="17" height="7" rx="3.5" />
      </g>
    </svg>
  );
}
