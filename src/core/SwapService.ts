import { MONETIZATION } from '../config/monetization';
import { generateSwapOffer, swapFingerprint } from './SwapGenerator';
import type { GameState, SwapOffer } from './types';

export function swapsRemaining(state: GameState): number {
  return Math.max(0,Math.min(MONETIZATION.maxSwapsPerGame,MONETIZATION.initialSwapsAvailable)-state.swapsUsed);
}
export function canSwap(state: GameState): boolean {
  return !state.over&&state.moves>=MONETIZATION.swapUnlockAfterPlacedPieces&&swapsRemaining(state)>0&&state.swapOperation?.status!=='pending';
}
export function prepareSwap(state: GameState, offer: SwapOffer): GameState | null {
  if(!canSwap(state)||offer.key!==swapFingerprint(state,offer.slot))return null;
  const expected=generateSwapOffer(state,offer.slot);
  if(JSON.stringify(expected)!==JSON.stringify(offer))return null;
  return {...state,swapOperation:{id:offer.key,offer,status:'pending',rewardsConfirmed:0}};
}
/** adIndex is an operation-local receipt index: repeated callbacks cannot advance it. */
export function confirmSwapReward(state: GameState, operationId: string, adIndex=0): GameState {
  const op=state.swapOperation;
  if(!op||op.id!==operationId||op.status!=='pending'||op.rewardsConfirmed!==adIndex)return state;
  if(op.offer.key!==swapFingerprint(state,op.offer.slot)||swapsRemaining(state)===0)return state;
  const rewardsConfirmed=op.rewardsConfirmed+1;
  if(rewardsConfirmed<MONETIZATION.rewardedAdsPerSwap)return {...state,swapOperation:{...op,rewardsConfirmed}};
  const tray=state.tray.map(p=>p?{...p}:null);tray[op.offer.slot]={...op.offer.to};
  return {...state,tray,swapsUsed:state.swapsUsed+1,swapOperation:{...op,status:'applied',rewardsConfirmed}};
}
export function cancelSwap(state: GameState): GameState {
  return state.swapOperation?.status==='pending'?{...state,swapOperation:null}:state;
}
