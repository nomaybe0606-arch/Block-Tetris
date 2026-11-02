import { VIEW } from '../config/layout';

export interface FrameFit { key: string; scale: number }

/** Centers and scales the fixed 480×850 frame inside the safe-area viewport. */
export function fitFrame(): FrameFit {
  const viewport = document.querySelector<HTMLElement>('#viewport')!, frame = document.querySelector<HTMLElement>('#frame')!;
  const style = getComputedStyle(viewport), left = parseFloat(style.paddingLeft) || 0, right = parseFloat(style.paddingRight) || 0;
  const top = parseFloat(style.paddingTop) || 0, bottom = parseFloat(style.paddingBottom) || 0;
  const w = viewport.clientWidth - left - right, h = viewport.clientHeight - top - bottom;
  const key = `${w}:${h}:${left}:${right}:${top}:${bottom}`;
  const scale = Math.min(w / VIEW.width, h / VIEW.height);
  if (frame.dataset.fit !== key) {
    frame.dataset.fit = key;
    frame.style.left = `${(viewport.clientWidth + left - right) / 2}px`; frame.style.top = `${(viewport.clientHeight + top - bottom) / 2}px`;
    frame.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  return { key, scale };
}

/** Keeps the loading screen fitted until the game takes over resizing. */
export function fitFrameWhileLoading(): () => void {
  const fit = () => { fitFrame(); };
  fit();
  window.addEventListener('resize', fit); window.visualViewport?.addEventListener('resize', fit);
  return () => { window.removeEventListener('resize', fit); window.visualViewport?.removeEventListener('resize', fit); };
}
