const paths: Record<string, string> = {
  settings: '<path d="m9.2 3-.6 2.1-1.8 1L4.7 6 3 9l1.5 1.6v2.8L3 15l1.7 3 2.1-.2 1.8 1 .6 2.2h3.6l.6-2.2 1.8-1 2.1.2 1.7-3-1.5-1.6v-2.8L19 9l-1.7-3-2.1.1-1.8-1-.6-2.1Z"/><circle cx="11" cy="12" r="3"/>',
  trophy: '<path d="M7 3h10v5c0 4-2 6-5 6S7 12 7 8V3Zm0 2H3v2c0 3 2 4 5 4m9-6h4v2c0 3-2 4-5 4M12 14v5m-5 2h10m-8-2h6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sound: '<path d="m11 4-5 4H3v8h3l5 4V4Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  restart: '<path d="M4 9a8 8 0 1 1 0 6M4 3v6h6"/>',
  home: '<path d="m3 11 9-8 9 8m-16-2v12h5v-7h4v7h5V9"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  sparkle: '<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z"/>',
};
export function icon(name: string, className = ''): string {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.sparkle}</svg>`;
}
export const logo = '<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>GRID <b>PULSE</b></span>';
