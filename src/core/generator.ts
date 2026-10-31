import { BALANCE } from '../config/balance';
import { hasMove } from './board';
import { SHAPES } from './shapes';
import { SeededRng } from './rng';
import type { Board, Piece, Shape } from './types';

function weight(shape: Shape, board: Board, tray: Piece[], fill: number): number {
  const cfg = BALANCE.generator, n = shape.cells.length;
  let w = n === 1 ? cfg.weights.single : n <= 3 ? cfg.weights.small : n <= 5 ? cfg.weights.medium : cfg.weights.large;
  if (fill > cfg.crowdedThreshold && n <= 3) w *= cfg.smallPieceBoost;
  if (!hasMove(board, shape)) w *= cfg.unplaceableMultiplier;
  if (tray.some(p => p.shapeId === shape.id)) w *= cfg.duplicateMultiplier;
  return w;
}
export function generateTray(board: Board, rng: SeededRng): Piece[] {
  const fill = board.flat().filter(Boolean).length / 64, tray: Piece[] = [];
  for (let i = 0; i < 3; i++) {
    const weights = SHAPES.map(s => weight(s, board, tray, fill));
    let sample = rng.next() * weights.reduce((a,b) => a+b, 0), selected = SHAPES[SHAPES.length-1];
    for (let j = 0; j < SHAPES.length; j++) { sample -= weights[j]; if (sample < 0) { selected = SHAPES[j]; break; } }
    tray.push({ shapeId: selected.id, color: rng.int(7) + 1 });
  }
  if (!tray.some(p => hasMove(board, SHAPES.find(s => s.id === p.shapeId)!))) {
    const legal = SHAPES.filter(s => hasMove(board, s));
    if (legal.length) tray[rng.int(3)] = { shapeId: legal[rng.int(legal.length)].id, color: rng.int(7) + 1 };
  }
  return tray;
}
