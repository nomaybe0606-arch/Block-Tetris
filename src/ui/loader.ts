export const LOADER = {
  // Counted from page navigation, so a fast (cached) start still shows the logo briefly.
  minVisibleMs: 1600,
  // Time for the bar to fill up before the screen fades.
  fillMs: 300,
  // Keep in sync with the #loader.loader-hide transition in style.css.
  fadeOutMs: 500,
  tickMs: 100,
  // Share of the remaining distance covered per tick while a stage is running.
  creep: 0.06,
};

// Downloads report no progress, so each boot stage gets a slice of the bar and the
// bar creeps through that slice; it never stalls and never runs ahead of the next stage.
let shown = 0;
let limit = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function draw(): void {
  const bar = document.querySelector<HTMLElement>('#loader .loading-track span');
  if (bar) bar.style.transform = `scaleX(${shown})`;
}
function stop(): void { if (timer) { clearInterval(timer); timer = null; } }

/** Starts a boot stage: the bar jumps to `from` and creeps towards `to`. */
export function loaderStage(from: number, to: number): void {
  shown = Math.max(shown, from); limit = Math.max(limit, to);
  draw();
  timer ??= setInterval(() => { shown += (limit - shown) * LOADER.creep; draw(); }, LOADER.tickMs);
}

/** Fills the bar, keeps the screen for its minimum time, fades it out and removes it. */
export function hideLoader(): Promise<void> {
  stop(); shown = 1; draw();
  const loader = document.querySelector<HTMLElement>('#loader');
  if (!loader) return Promise.resolve();
  const wait = Math.max(LOADER.fillMs, LOADER.minVisibleMs - performance.now());
  return new Promise(resolve => {
    setTimeout(() => {
      loader.classList.add('loader-hide');
      // A timer, not transitionend: with reduced motion the transition is disabled and never ends.
      setTimeout(() => { loader.remove(); resolve(); }, LOADER.fadeOutMs);
    }, wait);
  });
}

/** Shows the loading text in Russian for Russian-speaking players; the markup default is English. */
export function localizeLoader(language: string): void {
  const ru = /^ru/i.test(language);
  document.documentElement.lang = ru ? 'ru' : 'en';
  const text = document.querySelector('#loading-text');
  if (text && ru) text.textContent = 'Ловим твой ритм…';
}

/** Test hook: forgets the progress of a previous boot. */
export function resetLoader(): void { stop(); shown = 0; limit = 0; }
