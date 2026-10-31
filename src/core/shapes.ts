import type { Cell, Shape } from './types';

function shape(id: string, cells: Cell[]): Shape {
  return { id, cells, width: Math.max(...cells.map(c => c[0])) + 1, height: Math.max(...cells.map(c => c[1])) + 1 };
}
function rectangle(id: string, w: number, h: number): Shape {
  return shape(id, Array.from({ length: w * h }, (_, i) => [i % w, Math.floor(i / w)] as Cell));
}
function rotations(id: string, source: Cell[]): Shape[] {
  const result: Shape[] = [];
  let cells = source;
  for (let n = 0; n < 4; n++) {
    const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
    cells = cells.map(([x, y]) => [x - minX, y - minY] as Cell).sort((a,b) => a[1] - b[1] || a[0] - b[0]);
    if (!result.some(s => JSON.stringify(s.cells) === JSON.stringify(cells))) result.push(shape(`${id}-${n}`, cells));
    cells = cells.map(([x, y]) => [-y, x] as Cell);
  }
  return result;
}
export const SHAPES: Shape[] = [
  rectangle('single', 1, 1),
  ...[2,3,4,5].flatMap(n => [rectangle(`line-${n}-h`, n, 1), rectangle(`line-${n}-v`, 1, n)]),
  rectangle('square-2', 2, 2), rectangle('square-3', 3, 3),
  rectangle('rect-3x2', 3, 2), rectangle('rect-2x3', 2, 3),
  ...rotations('corner', [[0,0],[0,1],[1,1]]),
  ...rotations('L', [[0,0],[0,1],[0,2],[1,2]]),
  ...rotations('J', [[1,0],[1,1],[1,2],[0,2]]),
  ...rotations('T', [[0,0],[1,0],[2,0],[1,1]]),
  ...rotations('S', [[1,0],[2,0],[0,1],[1,1]]),
  ...rotations('Z', [[0,0],[1,0],[1,1],[2,1]]),
  shape('plus', [[1,0],[0,1],[1,1],[2,1],[1,2]]),
  ...rotations('large-L', [[0,0],[0,1],[0,2],[1,2],[2,2]]),
];
export const SHAPE_MAP = new Map(SHAPES.map(s => [s.id, s]));
export function getShape(id: string): Shape {
  const s = SHAPE_MAP.get(id);
  if (!s) throw new Error(`Unknown shape: ${id}`);
  return s;
}
