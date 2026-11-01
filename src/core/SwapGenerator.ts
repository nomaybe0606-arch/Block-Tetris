import { availableMoves } from './board';
import { SHAPES } from './shapes';
import { SeededRng } from './rng';
import type { GameState, SwapOffer } from './types';

export function swapFingerprint(state: GameState, slot: number): string {
  const text=JSON.stringify([state.id,state.board,state.tray,state.moves,state.rng,state.swapsUsed,slot]);
  let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  return `${state.id}-${state.moves}-${state.swapsUsed}-${slot}-${hash>>>0}`;
}
/** Pure preview: no game RNG advancement, score mutation, or hidden offer reroll. */
export function generateSwapOffer(state: GameState, slot: number): SwapOffer | null {
  const from=state.tray[slot];if(!from)return null;
  let legal=SHAPES.filter(shape=>shape.id!==from.shapeId&&availableMoves(state.board,shape).length>0);
  if(legal.some(shape=>shape.cells.length>1))legal=legal.filter(shape=>shape.cells.length>1);
  if(!legal.length)return null;
  const key=swapFingerprint(state,slot);
  let seed=0;for(const c of key)seed=Math.imul(seed,31)+c.charCodeAt(0)|0;
  const rng=new SeededRng(seed),weights=legal.map(s=>s.cells.length>=2&&s.cells.length<=4?3:1);
  let sample=rng.next()*weights.reduce((a,b)=>a+b,0),index=legal.length-1;
  for(let i=0;i<legal.length;i++){sample-=weights[i];if(sample<0){index=i;break;}}
  const shape=legal[index],positions=availableMoves(state.board,shape);
  return {key,slot,from:{...from},to:{shapeId:shape.id,color:from.color%7+1},position:positions[rng.int(positions.length)]};
}
