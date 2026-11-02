import { describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import { App } from '../src/App';
import { GameScene, type SceneDelegate } from '../src/scenes/GameScene';
import { BoardRenderer } from '../src/rendering/BoardRenderer';
import { Feedback } from '../src/rendering/Feedback';
import { NeonEffects } from '../src/rendering/NeonEffects';
import { captureClear } from '../src/rendering/ClearEvent';
import { DragController } from '../src/input/DragController';
import { newGame, placePiece } from '../src/core/game';
import { defaultProfile } from '../src/platform/profile';
import { getShape } from '../src/core/shapes';
import { GRID, TRAY } from '../src/config/layout';
import { renderScene } from './helpers/renderScene';

function fixture(){const state=newGame(17);state.board[0]=[1,1,1,1,1,1,1,0];state.tray=[{shapeId:'single',color:2},{shapeId:'single',color:3},null];return state;}
function setup(){
  const fake=renderScene(),board=new BoardRenderer(fake.scene),neon=new NeonEffects(fake.scene),feedback=new Feedback(fake.scene,neon,board.clearLayer);
  const app=Object.create(App.prototype) as App,profile=defaultProfile('en',false),saved:string[]=[];
  const platform={paused:false,gameplayAction:vi.fn(),save:vi.fn(async(data:string)=>{saved.push(data);return true;})};
  Object.assign(app,{state:fixture(),screen:'game',modal:null,platform,profile,swap:{busy:false,savePending:false},training:false,recordAnnounced:true,audio:{play:vi.fn()},render:vi.fn()});
  const delegate:SceneDelegate={get state(){return app.state;},reducedMotion:()=>false,pixelRatio:()=>1,canInteract:()=>app.canInteract(),isTutorial:()=>false,intenseEffects:()=>true,showSwapControl:()=>false,onPick:vi.fn(),onClearFeedback:vi.fn(),onSettled:vi.fn(),onReady:vi.fn(),onPlace:(slot,x,y)=>app.onPlace(slot,x,y)};
  const timers:{callback:()=>void;remove:()=>void}[]=[];
  const scene=new GameScene(delegate);Object.assign(scene,{boardView:board,feedback,neon,controls:{cancel:vi.fn(),update:vi.fn()},game:{loop:{actualFps:60}},tweens:fake.raw.tweens,time:{paused:false,delayedCall:vi.fn((_delay:number,callback:()=>void)=>{const timer={callback,remove:vi.fn()};timers.push(timer);return timer;})}});
  scene.refresh();return {fake,board,neon,feedback,app,profile,platform,saved,delegate,scene,timers,drop:(slot:number,x:number,y:number)=>{Object.assign(scene,{slot});scene['drop'](x,y);}};
}
describe('continuous logical play during independent clearing',()=>{
  it('enables the next move before the first clear has even started visually',()=>{
    const s=setup();s.drop(0,7,0);expect(s.app.canInteract()).toBe(true);expect(s.feedback.active).toBeGreaterThan(0);expect(s.app.state.board[0]).toEqual(Array(8).fill(0));
    expect(s.app.state.score).toBe(11);expect(s.app.state.combo).toBe(1);expect(JSON.parse(s.saved.at(-1)!).game.score).toBe(11);
    s.drop(1,0,0);expect(s.app.state.board[0][0]).toBe(3);expect(s.app.state.moves).toBe(2);expect(s.app.state.score).toBe(12);
  });
  it('never erases or fades a new cell at a previously cleared coordinate',()=>{
    const s=setup();s.drop(0,7,0);s.drop(1,0,0);
    const current=s.app.state,before=JSON.stringify(current),block=s.fake.nodes.find(node=>node.key==='block-3'&&node.x===58&&node.y===256)!;
    s.feedback.update(80);s.feedback.update(1000);s.fake.complete();
    expect(s.app.state).toBe(current);expect(JSON.stringify(s.app.state)).toBe(before);expect(block.visible).toBe(true);expect(block.alpha).toBe(1);
    expect(s.board.clearLayer.list.every(node=>(node as unknown)!==block)).toBe(true);expect(s.feedback.active).toBe(0);
    const order=s.board.root.list as unknown[];expect(order.indexOf(s.board.clearLayer)).toBeLessThan(order.indexOf(block.parent));
  });
  it('supports 100 rapid clearing placements with a fixed effects pool and correct combo/score',()=>{
    const s=setup(),pool=s.board.clearLayer.list.length;let expected=0;
    for(let i=0;i<100;i++){
      s.app.state={...s.app.state,board:fixture().board,tray:fixture().tray};s.board.render(s.app.state.board);s.board.renderTray(s.app.state,false);
      const allocations=s.fake.nodes.length;s.drop(0,7,0);expected+=1+10*Math.min(i+1,8);
      expect(s.app.canInteract()).toBe(true);expect(s.app.state.score).toBe(expected);expect(s.fake.nodes).toHaveLength(allocations);
      const snapshot=JSON.stringify(s.app.state);s.feedback.update(16);expect(JSON.stringify(s.app.state)).toBe(snapshot);expect(s.board.clearLayer.list).toHaveLength(pool);
    }
    expect(s.app.state.moves).toBe(100);expect(s.app.state.combo).toBe(100);expect(s.saved).toHaveLength(100);
    s.feedback.update(2000);s.neon.reset();s.fake.complete();expect(s.feedback.active).toBe(0);
    expect(s.fake.nodes.filter(node=>!node.destroyed).length).toBeLessThan(500);
  });
  it('captures colors and coordinates without retaining mutable board data',()=>{
    const state=fixture(),before=state.board,result=placePiece(state,0,7,0)!,event=captureClear(result,before,2);
    before[0][0]=7;result.cleared[0]=[6,6];result.rows.length=0;
    expect(event.cells[0]).toEqual({x:0,y:0,color:1});expect(event.cells[7]).toEqual({x:7,y:0,color:2});expect(event.rows).toEqual([0]);
  });
  it('cancels old visual callbacks when a new game replaces the scene state',()=>{
    const s=setup();s.drop(0,7,0);s.app.state=newGame(18);s.scene.refresh();const snapshot=JSON.stringify(s.app.state);
    s.feedback.update(2000);expect(s.delegate.onClearFeedback).not.toHaveBeenCalled();expect(s.feedback.active).toBe(0);expect(JSON.stringify(s.app.state)).toBe(snapshot);
  });
  it('keeps a genuine game-over state immutable while its final clear finishes',()=>{
    const s=setup(),blocked=newGame(1);blocked.tray=[{shapeId:'single',color:1},{shapeId:'square-3',color:2},null];
    blocked.board=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>(x+y)%2?1:0));blocked.board[0]=[0,1,1,1,1,1,1,1];s.app.state=blocked;s.board.render(blocked.board);s.board.renderTray(blocked,false);
    s.drop(0,0,0);expect(s.app.state.lines).toBe(1);expect(s.app.state.over).toBe(true);expect(s.app.canInteract()).toBe(false);expect(s.timers).toHaveLength(1);
    const saved=JSON.stringify(s.app.state);expect(JSON.parse(s.saved.at(-1)!).game.over).toBe(true);
    s.feedback.update(1000);s.timers[0].callback();expect(s.delegate.onSettled).toHaveBeenCalledTimes(1);expect(JSON.stringify(s.app.state)).toBe(saved);
  });
  it('overlaps two clear events without removing a cell from the intervening move',()=>{
    const s=setup();s.drop(0,7,0);s.drop(1,0,0);
    const board=s.app.state.board.map(row=>[...row]);board[1]=[1,1,1,1,1,1,1,0];
    s.app.state={...s.app.state,board,tray:fixture().tray};s.board.render(board);s.board.renderTray(s.app.state,false);s.drop(0,7,1);
    expect(s.app.state.lines).toBe(2);expect(s.app.state.combo).toBe(2);expect(s.app.state.score).toBe(33);const before=JSON.stringify(s.app.state);
    s.feedback.update(50);expect(s.delegate.onClearFeedback).toHaveBeenCalledTimes(2);s.feedback.update(1000);
    expect(s.app.state.board[0][0]).toBe(3);expect(JSON.stringify(s.app.state)).toBe(before);expect(s.feedback.active).toBe(0);
  });
  it('does not lose a second fast touch after the first touch clears a line',()=>{
    const dom=new Window();vi.stubGlobal('window',dom);vi.stubGlobal('document',dom.document);
    const s=setup(),canvas=dom.document.createElement('canvas');dom.document.body.append(canvas);
    canvas.getBoundingClientRect=()=>new dom.DOMRect(0,0,480,850);
    const held=new Set<number>();Object.assign(canvas,{setPointerCapture:(id:number)=>held.add(id),hasPointerCapture:(id:number)=>held.has(id),releasePointerCapture:(id:number)=>held.delete(id)});
    const controls=new DragController(canvas as unknown as HTMLCanvasElement,{enabled:()=>s.app.canInteract(),getPiece:slot=>{const piece=s.app.state.tray[slot],transform=s.board.trayTransform(slot);return piece&&transform?{piece,shape:getShape(piece.shapeId),transform}:null;},reducedMotion:()=>false,preparePickup:()=>{},begin:(slot,pose)=>s.scene['begin'](slot,pose),move:pose=>s.scene['move'](pose),end:(x,y)=>s.scene['drop'](x,y),cancel:()=>s.scene.cancel()});
    const fire=(type:string,id:number,x:number,y:number)=>canvas.dispatchEvent(new dom.PointerEvent(type,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y,bubbles:true,cancelable:true}));
    try{
      fire('pointerdown',1,TRAY.centers[0],TRAY.y);fire('pointerup',1,GRID.x+7*52+26,GRID.y+26);
      expect(s.app.state.lines).toBe(1);expect(s.feedback.active).toBeGreaterThan(0);
      fire('pointerdown',2,TRAY.centers[1],TRAY.y);fire('pointerup',2,GRID.x+26,GRID.y+26);
      expect(s.app.state.moves).toBe(2);expect(s.app.state.board[0][0]).toBe(3);expect(held.size).toBe(0);
    }finally{controls.destroy();dom.close();vi.unstubAllGlobals();}
  });
  it('can turn off ongoing motion without touching the committed board or blocking input',()=>{
    const s=setup();s.drop(0,7,0);const before=JSON.stringify(s.app.state);s.delegate.reducedMotion=()=>true;s.scene.update(0,16);
    expect(s.feedback.active).toBe(0);expect(JSON.stringify(s.app.state)).toBe(before);expect(s.app.canInteract()).toBe(true);
  });
});
