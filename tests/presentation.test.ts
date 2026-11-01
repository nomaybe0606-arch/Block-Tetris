import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import { GameScene, type SceneDelegate } from '../src/scenes/GameScene';
import { newGame, placePiece } from '../src/core/game';
import { ANIMATION } from '../src/config/animation';
import { FEEDBACK } from '../src/config/feedback';

beforeEach(()=>{vi.stubGlobal('window',{removeEventListener:vi.fn()});});
function setup(over=false,reduced=false,clear=false){
  const state=newGame(1);state.tray=[{shapeId:'single',color:1},null,null];
  if(clear)state.board[0]=[1,1,1,1,1,1,1,0];
  const delegate:SceneDelegate={state,reducedMotion:()=>reduced,pixelRatio:()=>1,canInteract:()=>true,isTutorial:()=>false,intenseEffects:()=>true,showSwapControl:()=>false,onPick:vi.fn(),onClearFeedback:vi.fn(),onSettled:vi.fn(),onReady:vi.fn(),onPlace:vi.fn((slot,x,y)=>{const result=placePiece(delegate.state,slot,x,y)!;result.state.over=over;delegate.state=result.state;return result;})};
  const timers:{delay:number;callback:()=>void;removed:boolean;remove:()=>void}[]=[];
  const board={render:vi.fn(),showTutorial:vi.fn(),renderTray:vi.fn(),landCells:vi.fn(),clearCells:vi.fn(),clearPreview:vi.fn(),releaseDrag:vi.fn(),root:{setVisible:vi.fn()},slotVisible:vi.fn()};
  const feedback={points:vi.fn(),clear:vi.fn(),reset:vi.fn()},neon={end:vi.fn(),placement:vi.fn(),clearAccent:vi.fn(),reset:vi.fn()};
  const scene=new GameScene(delegate);
  Object.assign(scene,{boardView:board,feedback,neon,slot:0,controls:{cancel:vi.fn()},time:{delayedCall:(delay:number,callback:()=>void)=>{const event={delay,callback,removed:false,remove(){this.removed=true;}};timers.push(event);return event;}}});
  const drop=()=>scene['drop'](clear?7:0,0);
  const run=(index:number)=>{if(!timers[index].removed)timers[index].callback();};
  return {scene,delegate,board,feedback,neon,timers,drop,run};
}
describe('placement presentation sequencing',()=>{
  it('renders an ordinary move once and keeps interaction immediately available',()=>{
    const s=setup();s.drop();expect(s.board.render).toHaveBeenCalledTimes(1);expect(s.board.landCells).toHaveBeenCalledTimes(1);expect(s.delegate.onSettled).toHaveBeenCalledTimes(1);expect(s.timers).toHaveLength(0);
  });
  it('starts clear visuals and audio together and settles only after the clear',()=>{
    const s=setup(false,false,true);s.drop();expect(s.delegate.onSettled).not.toHaveBeenCalled();
    expect(s.timers.map(event=>event.delay)).toEqual([FEEDBACK.clearLeadMs,FEEDBACK.clearLeadMs+FEEDBACK.clearDurationMs]);
    s.run(0);expect(s.delegate.onClearFeedback).toHaveBeenCalledTimes(1);expect(s.board.clearCells).toHaveBeenCalledTimes(1);expect(s.feedback.clear).toHaveBeenCalledTimes(1);
    s.run(1);expect(s.board.render).toHaveBeenCalledTimes(2);expect(s.delegate.onSettled).toHaveBeenCalledTimes(1);
  });
  it('lets the last placement finish before showing game over',()=>{
    const s=setup(true);s.drop();expect(s.delegate.onSettled).not.toHaveBeenCalled();expect(s.timers[0].delay).toBe(ANIMATION.endRoundHoldMs);s.run(0);expect(s.delegate.onSettled).toHaveBeenCalledTimes(1);
  });
  it('adds the final hold after, rather than during, line clearing',()=>{
    const s=setup(true,false,true);s.drop();s.run(0);s.run(1);expect(s.delegate.onSettled).not.toHaveBeenCalled();expect(s.timers[2].delay).toBe(ANIMATION.endRoundHoldMs);s.run(2);expect(s.delegate.onSettled).toHaveBeenCalledTimes(1);
  });
  it('omits the extra end hold in Reduced Motion',()=>{
    const s=setup(true,true);s.drop();expect(s.timers).toHaveLength(0);expect(s.delegate.onSettled).toHaveBeenCalledTimes(1);expect(s.board.landCells).toHaveBeenCalledWith(expect.anything(),true);
  });
  it('cancels pending presentation when returning to menu',()=>{
    const s=setup(true);s.drop();s.scene.show(false);s.run(0);expect(s.timers[0].removed).toBe(true);expect(s.delegate.onSettled).not.toHaveBeenCalled();expect(s.feedback.reset).toHaveBeenCalledTimes(1);
  });
  it('ignores a delayed game-over callback belonging to an older game',()=>{
    const s=setup(true);s.drop();s.delegate.state=newGame(2);s.run(0);expect(s.delegate.onSettled).not.toHaveBeenCalled();
  });
});
