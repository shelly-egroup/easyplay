// 畫面特效：迸開的小粒子、飄起來的「+1」。直接操作 DOM，不經過 React，才夠順。

let layer: HTMLDivElement | null = null;

function fxLayer() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'fx';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function burst(x: number, y: number, color: string, count: number, distance = 60) {
  if (prefersReducedMotion() || !Element.prototype.animate) return;
  const host = fxLayer();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const size = 7 + Math.random() * 9;
    p.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;background:${color}`;
    if (i % 3 === 0) p.className = 'sq';
    host.appendChild(p);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.8;
    const d = distance * (0.55 + Math.random() * 0.7);
    const anim = p.animate(
      [
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * d}px,${Math.sin(angle) * d}px) scale(.15) rotate(${(Math.random() - 0.5) * 300}deg)`,
          opacity: 0,
        },
      ],
      { duration: 520 + Math.random() * 260, easing: 'cubic-bezier(.15,.75,.3,1)' }
    );
    anim.onfinish = () => p.remove();
  }
}

export function floatText(x: number, y: number, text: string, color: string) {
  if (!Element.prototype.animate) return;
  const p = document.createElement('b');
  p.className = 'fx-float';
  p.textContent = text;
  p.style.cssText = `left:${x}px;top:${y}px;color:${color}`;
  fxLayer().appendChild(p);
  const anim = p.animate(
    [
      { transform: 'translate(-50%,-30%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-70%) scale(1.1)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-170%) scale(1)', opacity: 0 },
    ],
    { duration: 950, easing: 'cubic-bezier(.2,.8,.3,1)' }
  );
  anim.onfinish = () => p.remove();
}

/** 輕輕左右搖一下（點錯時） */
export function shake(el: Element | null | undefined) {
  el?.animate?.(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-7%) rotate(-3deg)' },
      { transform: 'translateX(6%) rotate(2deg)' },
      { transform: 'translateX(-4%)' },
      { transform: 'translateX(2%)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 420, easing: 'ease-out' }
  );
}
