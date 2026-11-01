export type Cell = readonly [x: number, y: number];
export type Board = number[][];
export interface Shape { id: string; cells: readonly Cell[]; width: number; height: number }
export interface Piece { shapeId: string; color: number }
export interface SwapOffer { key: string; slot: number; from: Piece; to: Piece; position: Cell }
export interface SwapOperation { id: string; offer: SwapOffer; status: 'pending' | 'applied'; rewardsConfirmed: number }
export interface GameState {
  version: 2; id: string; swapsUsed: number; swapOperation: SwapOperation | null; board: Board; tray: (Piece | null)[];
  score: number; best: number; combo: number; misses: number;
  maxCombo: number; lines: number; moves: number; rng: number; over: boolean;
}
export interface Placement {
  state: GameState; placed: Cell[]; cleared: Cell[]; rows: number[]; columns: number[]; points: number;
}
