import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import { GameScene, type SceneDelegate } from '../src/scenes/GameScene';
import { BoardRenderer } from '../src/rendering/BoardRenderer';
import { Feedback } from '../src/rendering/Feedback';
import { NeonEffects } from '../src/rendering/NeonEffects';
import { newGame, placePiece } from '../src/core/game';
import { renderScene } from './helpers/renderScene';

describe('repeatable clear audit (CPU harness, not device FPS)',()=>{
  it('records event allocations and work for identical 100-clear workloads',()=>{
    const report=[];
    for(const lines of [1,2,4]){
      const fake=renderScene(),board=new BoardRenderer(fake.scene),neon=new NeonEffects(fake.scene),feedback=new Feedback(fake.scene,neon,board.clearLayer);
      let state=newGame(42),elapsed=0,max=0,tweens=0,textUpdates=0,objects=0,peakTweens=0;
      const events:{callback:()=>void;removed:boolean;remove:()=>void}[]=[];
      const delegate:SceneDelegate={state,reducedMotion:()=>false,pixelRatio:()=>1,canInteract:()=>!delegate.state.over,isTutorial:()=>false,intenseEffects:()=>true,showSwapControl:()=>false,onPick:()=>{},onClearFeedback:()=>{},onSettled:()=>{},onReady:()=>{},onPlace:(slot,x,y)=>{const result=placePiece(delegate.state,slot,x,y);if(result)delegate.state=result.state;return result;}};
      const scene=new GameScene(delegate);
      Object.assign(scene,{boardView:board,feedback,neon,controls:{cancel:()=>{}},time:{delayedCall:(_delay:number,callback:()=>void)=>{const event={callback,removed:false,remove(){this.removed=true;}};events.push(event);return event;}}});
      for(let iteration=0;iteration<110;iteration++){
        state=newGame(42);state.tray=[{shapeId:lines===1?'single':`line-${lines}-v`,color:2},{shapeId:'single',color:1},null];
        for(let y=0;y<lines;y++){state.board[y].fill(1);state.board[y][7]=0;}
        delegate.state=state;scene.refresh();feedback.reset();neon.reset();events.length=0;Object.assign(scene,{slot:0});
        fake.resetPeak();const before=fake.tweens.length,allocated=fake.nodes.length,textBefore=fake.nodes.reduce((sum,node)=>sum+node.textUpdates,0),start=performance.now();
        scene['drop'](7,0);for(const event of events)if(!event.removed)event.callback();
        const ms=performance.now()-start;
        // The next implementation's frame-driven effects use this same replay boundary.
        const framed=feedback as Feedback&{update?:(delta:number)=>void};framed.update?.(500);fake.complete();
        if(iteration>=10){elapsed+=ms;max=Math.max(max,ms);objects+=fake.nodes.length-allocated;tweens+=fake.tweens.length-before;peakTweens=Math.max(peakTweens,fake.peakTweens);textUpdates+=fake.nodes.reduce((sum,node)=>sum+node.textUpdates,0)-textBefore;}
      }
      const result={lines,clears:100,newGameObjectsPerClear:objects/100,tweensPerClear:tweens/100,peakTweens,canvasTextCallsPerClear:textUpdates/100,cpuMeanMs:elapsed/100,cpuMaxMs:max};report.push(result);
      expect(objects).toBe(0);expect(delegate.state.lines).toBe(lines);
    }
    if(process.env.GP_AUDIT_STAGE){mkdirSync('artifacts/performance',{recursive:true});writeFileSync(`artifacts/performance/${process.env.GP_AUDIT_STAGE}.json`,JSON.stringify({kind:'synthetic CPU harness; no GPU, browser, audio or Bridge Storage',report},null,2));console.log(JSON.stringify(report));}
  });
});
