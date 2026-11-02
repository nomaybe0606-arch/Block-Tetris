import type { Board, Cell, Placement } from '../core/types';

export interface ClearEvent {
  readonly gameId:string;readonly move:number;readonly points:number;readonly combo:number;
  readonly rows:readonly number[];readonly columns:readonly number[];
  readonly cells:readonly {readonly x:number;readonly y:number;readonly color:number}[];
}
/** Copy only event data. No effect retains or writes the live board or GameState. */
export function captureClear(result:Placement,before:Board,placedColor:number):ClearEvent{
  return {gameId:result.state.id,move:result.state.moves,points:result.points,combo:result.state.combo,
    rows:[...result.rows],columns:[...result.columns],cells:result.cleared.map(([x,y]:Cell)=>({x,y,color:before[y][x]||placedColor}))};
}
