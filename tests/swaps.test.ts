import { describe, expect, it } from 'vitest';
import { newGame, placePiece } from '../src/core/game';
import { canPlace } from '../src/core/board';
import { getShape } from '../src/core/shapes';
import { generateSwapOffer } from '../src/core/SwapGenerator';
import { canSwap, cancelSwap, confirmSwapReward, prepareSwap, swapsRemaining } from '../src/core/SwapService';
import { restoreGame, serializeGame } from '../src/core/serialization';
import { defaultProfile, restoreProfile } from '../src/platform/profile';
import type { GameState } from '../src/core/types';

const ready=():GameState=>({...newGame(82,500),moves:6,score:90});
function swap(state:GameState,slot=0):GameState {
  const prepared=prepareSwap(state,generateSwapOffer(state,slot)!)!;
  return confirmSwapReward(prepared,prepared.swapOperation!.id);
}
describe('rewarded swaps and save migration',()=>{
  it('unlocks only after six placed pieces and while the game continues',()=>{
    expect(canSwap(newGame(82))).toBe(false);expect(canSwap({...ready(),moves:5})).toBe(false);
    expect(canSwap(ready())).toBe(true);expect(canSwap({...ready(),over:true})).toBe(false);
  });
  it('allows three rewarded replacements and refuses a fourth',()=>{
    let state=ready();
    for(let used=1;used<=3;used++){state=swap(state);expect(state.swapsUsed).toBe(used);expect(swapsRemaining(state)).toBe(3-used);}
    expect(prepareSwap(state,generateSwapOffer(state,0)!)).toBeNull();
    expect(swapsRemaining(newGame(83,state.best))).toBe(3);
  });
  it('changes only the selected tray slot and quota, preserving the common score and RNG',()=>{
    const state=ready(),offer=generateSwapOffer(state,1)!,next=swap(state,1);
    expect(next.tray[1]).toEqual(offer.to);expect(next.tray[0]).toEqual(state.tray[0]);expect(next.tray[2]).toEqual(state.tray[2]);
    for(const key of ['board','score','best','combo','moves','lines','rng'] as const)expect(next[key]).toEqual(state[key]);
    expect(state.swapsUsed).toBe(0);expect(state.swapOperation).toBeNull();
  });
  it('does not reroll or mutate state when reopening or changing selection',()=>{
    const state=ready(),before=serializeGame(state),first=generateSwapOffer(state,0);
    generateSwapOffer(state,1);generateSwapOffer(state,2);
    expect(generateSwapOffer(state,0)).toEqual(first);expect(serializeGame(state)).toBe(before);
  });
  it('offers a different shape that actually fits, across many seeds and slots',()=>{
    for(let seed=1;seed<=70;seed++)for(let slot=0;slot<3;slot++){
      const state={...ready(),...newGame(seed),moves:6},offer=generateSwapOffer(state,slot)!;
      expect(offer.to.shapeId).not.toBe(offer.from.shapeId);expect(offer.to.shapeId).not.toBe('single');
      expect(canPlace(state.board,getShape(offer.to.shapeId),...offer.position)).toBe(true);
    }
  });
  it('uses a single cell only when no larger alternative fits',()=>{
    const state=ready();state.board=Array.from({length:8},()=>Array(8).fill(1));state.board[4][4]=0;
    state.tray[0]={shapeId:'square-2',color:1};
    expect(generateSwapOffer(state,0)?.to.shapeId).toBe('single');
    state.tray[0]={shapeId:'single',color:1};expect(generateSwapOffer(state,0)).toBeNull();
    state.board[4][4]=1;expect(generateSwapOffer(state,1)).toBeNull();
  });
  it('rejects empty slots, stale previews and tampered offers',()=>{
    const state=ready(),offer=generateSwapOffer(state,0)!;
    expect(prepareSwap({...state,moves:7},offer)).toBeNull();
    expect(prepareSwap(state,{...offer,to:{shapeId:'single',color:7}})).toBeNull();
    expect(generateSwapOffer({...state,tray:[null,null,null]},0)).toBeNull();
  });
  it('freezes placement during the pending ad and cancels without spending quota',()=>{
    const state=ready(),pending=prepareSwap(state,generateSwapOffer(state,0)!)!;
    expect(canSwap(pending)).toBe(false);expect(placePiece(pending,1,0,0)).toBeNull();
    expect(cancelSwap(pending)).toEqual(state);
  });
  it('ignores wrong operation IDs, out-of-order and duplicate receipts',()=>{
    const state=ready(),pending=prepareSwap(state,generateSwapOffer(state,0)!)!,id=pending.swapOperation!.id;
    expect(confirmSwapReward(pending,'unrelated')).toBe(pending);expect(confirmSwapReward(pending,id,1)).toBe(pending);
    const applied=confirmSwapReward(pending,id);
    expect(confirmSwapReward(applied,id)).toBe(applied);expect(cancelSwap(applied)).toBe(applied);
  });
  it('preserves used quota, chosen piece and best score across reload',()=>{
    const state=swap(swap(ready())),restored=restoreGame(serializeGame(state))!;
    expect(restored.swapsUsed).toBe(2);expect(swapsRemaining(restored)).toBe(1);
    expect(restored.tray).toEqual(state.tray);expect(restored.best).toBe(500);expect(restored.swapOperation).toBeNull();
  });
  it('does not grant an interrupted pending ad after reload',()=>{
    const state=ready(),pending=prepareSwap(state,generateSwapOffer(state,0)!)!,restored=restoreGame(pending)!;
    expect(restored.tray).toEqual(state.tray);expect(restored.swapsUsed).toBe(0);expect(restored.swapOperation).toBeNull();
    expect(confirmSwapReward(restored,pending.swapOperation!.id)).toBe(restored);
  });
  it('migrates v1 profile without resetting board, current score, best or settings',()=>{
    const game={...ready(),version:1};
    const legacy={...defaultProfile('ru',false),version:1,game,best:850,settings:{sound:false,music:false,mute:true,reducedMotion:true,language:'ru'}};
    const restored=restoreProfile(JSON.stringify(legacy),defaultProfile('en',false));
    expect(restored.version).toBe(2);expect(restored.game?.version).toBe(2);expect(restored.game?.swapsUsed).toBe(0);
    expect(restored.game?.board).toEqual(game.board);expect(restored.game?.score).toBe(90);expect(restored.best).toBe(850);
    expect(restored.game?.best).toBe(850);
    expect(restored.settings).toMatchObject(legacy.settings);expect(restored.settings.intenseEffects).toBe(true);
  });
  it('roundtrips selected slot and disabled effects with the shared best score',()=>{
    const profile={...defaultProfile('en',false),game:swap(ready()),selectedSwapSlot:2};profile.settings.intenseEffects=false;
    const restored=restoreProfile(JSON.stringify(profile),defaultProfile('en',false));
    expect(restored.best).toBe(500);expect(restored.selectedSwapSlot).toBe(2);expect(restored.settings.intenseEffects).toBe(false);
  });
  it('rejects corrupted v2 quota instead of granting a reset',()=>{
    for(const swapsUsed of [-1,4,1.5])expect(restoreGame({...ready(),swapsUsed})).toBeNull();
  });
});
