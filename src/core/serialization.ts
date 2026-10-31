import { isGameOver } from './game';
import { SHAPE_MAP } from './shapes';
import type { GameState } from './types';

const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
export function serializeGame(state: GameState): string { return JSON.stringify(state); }
export function restoreGame(raw: unknown): GameState | null {
  try {
    const s = (typeof raw === 'string' ? JSON.parse(raw) : raw) as GameState;
    if (!s || s.version !== 1 || !Array.isArray(s.board) || s.board.length !== 8 || !s.board.every(row => Array.isArray(row) && row.length === 8 && row.every(c => integer(c, 7)))) return null;
    if (!Array.isArray(s.tray) || s.tray.length !== 3 || !s.tray.some(Boolean) || !s.tray.every(p => p === null || (typeof p === 'object' && SHAPE_MAP.has(p.shapeId) && integer(p.color, 7) && p.color > 0))) return null;
    if (!['score','best','combo','misses','maxCombo','lines','moves','rng'].every(key => integer(s[key as keyof GameState]))) return null;
    if (!integer(s.rng, 0xffffffff) || s.best < s.score || s.maxCombo < s.combo) return null;
    return { ...s, board: s.board.map(r => [...r]), tray: s.tray.map(p => p ? { ...p } : null), over: isGameOver(s) };
  } catch { return null; }
}
