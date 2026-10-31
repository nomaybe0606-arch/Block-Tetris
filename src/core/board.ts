import type { Board, Cell, Shape } from './types';
export const SIZE = 8;
export const emptyBoard = (): Board => Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
export const cloneBoard = (board: Board): Board => board.map(row => [...row]);
export function canPlace(board: Board, shape: Shape, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && shape.cells.every(([dx,dy]) => {
    const cx = x + dx, cy = y + dy;
    return cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === 0;
  });
}
export function availableMoves(board: Board, shape: Shape): Cell[] {
  const result: Cell[] = [];
  for (let y = 0; y <= SIZE - shape.height; y++) for (let x = 0; x <= SIZE - shape.width; x++) {
    if (canPlace(board, shape, x, y)) result.push([x,y]);
  }
  return result;
}
export function hasMove(board: Board, shape: Shape): boolean {
  for (let y = 0; y <= SIZE - shape.height; y++) for (let x = 0; x <= SIZE - shape.width; x++) if (canPlace(board, shape, x, y)) return true;
  return false;
}
export function findLines(board: Board): { rows: number[]; columns: number[]; cells: Cell[] } {
  const rows: number[] = [], columns: number[] = [], cells: Cell[] = [];
  for (let y = 0; y < SIZE; y++) if (board[y].every(Boolean)) rows.push(y);
  for (let x = 0; x < SIZE; x++) if (board.every(row => row[x] !== 0)) columns.push(x);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (rows.includes(y) || columns.includes(x)) cells.push([x,y]);
  return { rows, columns, cells };
}
export function clearLines(board: Board) {
  const lines = findLines(board), result = cloneBoard(board);
  for (const [x,y] of lines.cells) result[y][x] = 0;
  return { board: result, ...lines };
}
