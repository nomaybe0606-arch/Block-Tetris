import { BALANCE } from '../config/balance';
import { canPlace, clearLines, cloneBoard, emptyBoard, hasMove } from './board';
import { generateTray } from './generator';
import { getShape } from './shapes';
import { SeededRng } from './rng';
import type { Cell, GameState, Placement } from './types';

export function isGameOver(state: Pick<GameState, 'board' | 'tray'>): boolean {
  return !state.tray.some(p => p && hasMove(state.board, getShape(p.shapeId)));
}
export function newGame(seed: number, best = 0): GameState {
  const rng = new SeededRng(seed), board = emptyBoard(), tray = generateTray(board, rng);
  return { version: 1, board, tray, score: 0, best, combo: 0, misses: 0, maxCombo: 0, lines: 0, moves: 0, rng: rng.state, over: false };
}
export function placePiece(state: GameState, slot: number, x: number, y: number): Placement | null {
  const piece = state.tray[slot];
  if (!piece || state.over) return null;
  const shape = getShape(piece.shapeId);
  if (!canPlace(state.board, shape, x, y)) return null;
  const board = cloneBoard(state.board), placed = shape.cells.map(([dx,dy]) => [x+dx, y+dy] as Cell);
  for (const [cx,cy] of placed) board[cy][cx] = piece.color;
  const clear = clearLines(board), count = clear.rows.length + clear.columns.length;
  const misses = count ? 0 : state.misses + 1;
  const combo = count ? state.combo + 1 : misses > BALANCE.comboGraceMoves ? 0 : state.combo;
  const points = placed.length * BALANCE.cellPoints + (count ? BALANCE.lineBonus * count ** BALANCE.lineExponent * Math.min(combo, BALANCE.comboMax) : 0);
  const tray = [...state.tray]; tray[slot] = null;
  const rng = new SeededRng(state.rng);
  const next: GameState = {
    ...state, board: clear.board, tray: tray.every(p => p === null) ? generateTray(clear.board, rng) : tray,
    score: state.score + points, best: Math.max(state.best, state.score + points), combo, misses,
    maxCombo: Math.max(state.maxCombo, combo), lines: state.lines + count, moves: state.moves + 1, rng: rng.state,
  };
  next.over = isGameOver(next);
  return { state: next, placed, cleared: clear.cells, rows: clear.rows, columns: clear.columns, points };
}
export function tutorialGame(seed: number, best: number): GameState {
  const state = newGame(seed, best);
  for (let x = 0; x < 5; x++) state.board[6][x] = 2;
  state.tray = [{ shapeId: 'line-3-h', color: 2 }, null, null];
  return state;
}
