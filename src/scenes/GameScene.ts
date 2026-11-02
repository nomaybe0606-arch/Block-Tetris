import Phaser from 'phaser';
import { GRID } from '../config/layout';
import { DRAG } from '../config/controls';
import { FEEDBACK } from '../config/feedback';
import { ANIMATION } from '../config/animation';
import { canPlace } from '../core/board';
import { getShape } from '../core/shapes';
import type { GameState, Placement, SwapOffer } from '../core/types';
import { DragController } from '../input/DragController';
import type { DragPose } from '../input/dragGeometry';
import { BoardRenderer } from '../rendering/BoardRenderer';
import { Feedback } from '../rendering/Feedback';
import { createTextures } from '../rendering/textures';
import { NeonEffects } from '../rendering/NeonEffects';
import { SwapAnimation } from '../rendering/SwapAnimation';
import type { PerfDiagnostics } from '../debug/PerfDiagnostics';
import { captureClear, type ClearEvent } from '../rendering/ClearEvent';

export interface SceneDelegate {
  state: GameState; reducedMotion(): boolean; pixelRatio(): number; canInteract(): boolean; isTutorial(): boolean;
  intenseEffects():boolean;showSwapControl():boolean;
  onPlace(slot: number,x: number,y: number): Placement | null;
  onPick(): void; onClearFeedback(event: ClearEvent): void; onSettled(): void; onReady(scene: GameScene): void;
}
export class GameScene extends Phaser.Scene {
  private boardView!: BoardRenderer;
  private feedback!: Feedback;
  private controls!: DragController;
  private delegate: SceneDelegate;
  private drag: Phaser.GameObjects.Container | null = null;
  private returning: Phaser.GameObjects.Container | null = null;
  private returningSlot = -1;
  private slot = -1;
  private keyboardCell = {x:0,y:0};
  private neon!:NeonEffects;
  private swapAnimation!:SwapAnimation;
  private pending:Phaser.Time.TimerEvent[]=[];
  private diagnostics:PerfDiagnostics|null=null;
  private placementMs=0;private clearMs=0;private stopped=false;
  private reducedEffects=false;
  constructor(delegate: SceneDelegate) { super('Classic');this.delegate=delegate; }
  create(): void {
    this.cameras.main.setZoom(this.delegate.pixelRatio()).centerOn(240,425);
    createTextures(this);
    this.boardView=new BoardRenderer(this);this.neon=new NeonEffects(this);this.feedback=new Feedback(this,this.neon,this.boardView.clearLayer);this.swapAnimation=new SwapAnimation(this,this.boardView,this.neon);
    this.controls=new DragController(this.game.canvas,{
      enabled:()=>this.delegate.canInteract(),
      getPiece:slot=>{
        const piece=this.delegate.state.tray[slot],transform=this.boardView.trayTransform(slot);
        return piece&&transform?{piece,shape:getShape(piece.shapeId),transform}:null;
      },
      reducedMotion:()=>this.delegate.reducedMotion(),
      preparePickup:()=>{this.cancelDrag();this.finishReturn();},
      begin:(slot,pose)=>this.begin(slot,pose),move:pose=>this.move(pose),end:(c,r)=>this.drop(c,r),cancel:()=>this.cancelDrag(),
    });
    window.addEventListener('keydown',this.key);
    this.events.once('shutdown',()=>{this.stopped=true;this.diagnostics?.destroy();this.cancelPresentation();this.controls.destroy();this.swapAnimation.cancel();this.neon.destroy();window.removeEventListener('keydown',this.key);});
    if(import.meta.env.DEV&&new URLSearchParams(location.search).get('perf')==='1'){
      void import('../debug/PerfDiagnostics').then(({PerfDiagnostics})=>{if(!this.stopped)this.diagnostics=new PerfDiagnostics(()=>({activeEffects:this.feedback.active+this.neon.active,activeTweens:this.tweens.getTweens().length,placementMs:this.placementMs,clearMs:this.clearMs}));});
    }
    this.delegate.onReady(this);
  }
  show(visible: boolean): void { this.boardView.root.setVisible(visible); if(!visible) {this.cancelPresentation();this.cancel();this.finishReturn();this.neon.reset();this.feedback.reset();} }
  refresh(animate = false): void {
    this.cancelPresentation();
    this.feedback.reset();
    this.finishReturn();
    this.boardView.render(this.delegate.state.board);
    this.boardView.renderTray(this.delegate.state,this.delegate.reducedMotion(),animate,this.delegate.showSwapControl());
    this.boardView.showTutorial(this.delegate.isTutorial());
  }
  cancel(): void { this.controls?.cancel();this.cancelDrag(); }
  private decorReduced():boolean{return this.delegate.reducedMotion()||!this.delegate.intenseEffects();}
  isDragging():boolean{return this.controls?.dragging||this.drag!==null;}
  record():void{this.neon.pulse(360,145,190,140,0xffd578,.6);}
  animateSwap(offer:SwapOffer):Promise<void>{this.cancel();return this.swapAnimation.play(offer,this.decorReduced());}
  update(_time:number,delta:number):void{
    this.controls?.update();const reduced=this.delegate.reducedMotion(),intense=this.delegate.intenseEffects(),minimal=reduced||!intense;
    if(minimal&&!this.reducedEffects)this.feedback.reset();this.reducedEffects=minimal;
    this.neon?.configure(reduced,intense,this.game.loop.actualFps);
    const step=this.time.paused?0:Math.max(0,Math.min(delta,100));this.neon?.update(step);this.feedback?.update(step);this.diagnostics?.frame(this.time.paused);
  }
  private begin(slot:number,pose:DragPose): void {
    this.cancelDrag();this.finishReturn();const piece=this.delegate.state.tray[slot];if(!piece)return;
    this.slot=slot;this.boardView.slotVisible(slot,false);
    this.drag=this.boardView.acquireDrag(piece,getShape(piece.shapeId)).setPosition(pose.x,pose.y).setDepth(30).setScale(pose.scale).setAlpha(.96);
    this.neon.configure(this.delegate.reducedMotion(),this.delegate.intenseEffects(),this.game.loop.actualFps);this.neon.begin(getShape(piece.shapeId),piece.color,pose);
    this.delegate.onPick();
  }
  private move({x,y,scale,column,row}:DragPose): void {
    if(!this.drag)return;
    const piece=this.delegate.state.tray[this.slot];if(!piece)return;
    const allowed=!this.delegate.isTutorial()||(column===5&&row===6);
    const valid=this.boardView.showPreview(this.delegate.state.board,getShape(piece.shapeId),column,row,allowed,this.decorReduced());
    this.drag.setPosition(x,y).setScale(scale).setAlpha(valid?0.98:0.86);
    this.neon.move({x,y,scale,column,row});
  }
  private drop(x:number,y:number): void {
    const started=this.diagnostics?performance.now():0;
    const slot=this.slot,piece=this.delegate.state.tray[slot];
    if(!piece)return this.cancelDrag();
    const valid=canPlace(this.delegate.state.board,getShape(piece.shapeId),x,y)&&(!this.delegate.isTutorial()||(x===5&&y===6));
    if(!valid)return this.cancelDrag();
    const previous=this.delegate.state.board;
    this.boardView.releaseDrag();this.drag=null;this.slot=-1;this.boardView.clearPreview();
    this.neon.end();
    const result=this.delegate.onPlace(slot,x,y);
    if(!result) {this.refresh();return;}
    // Commit/render the already-cleared logical board exactly once. Ghosts are a separate layer.
    this.boardView.render(result.state.board);this.boardView.showTutorial(false);
    this.boardView.renderTray(result.state,this.delegate.reducedMotion(),result.state.tray.every(Boolean),this.delegate.showSwapControl());
    this.boardView.landCells(result.placed,this.decorReduced());this.neon.placement(result,piece.color);
    if(result.cleared.length) {
      const start=this.diagnostics?performance.now():0,event=captureClear(result,previous,piece.color);
      this.feedback.clear(event,this.decorReduced(),()=>this.delegate.onClearFeedback(event));
      if(this.diagnostics)this.clearMs=performance.now()-start;
      this.finishPlacement(result);
    } else {
      this.feedback.points(result.points,GRID.x+x*52+26,GRID.y+y*52+12,this.delegate.reducedMotion());
      this.finishPlacement(result);
    }
    if(this.diagnostics)this.placementMs=performance.now()-started;
  }
  private finishPlacement(result:Placement):void{
    const finish=()=>{if(this.delegate.state!==result.state)return;this.delegate.onSettled();};
    if(result.state.over&&!this.delegate.reducedMotion())this.later(ANIMATION.endRoundHoldMs+(result.cleared.length?FEEDBACK.clearLeadMs+FEEDBACK.clearDurationMs:0),finish);
    else finish();
  }
  private later(delay:number,callback:()=>void):void{
    const event=this.time.delayedCall(delay,()=>{this.pending=this.pending.filter(item=>item!==event);callback();});this.pending.push(event);
  }
  private cancelPresentation():void{for(const event of this.pending)event.remove(false);this.pending=[];}
  private cancelDrag(): void {
    const drag=this.drag,slot=this.slot;
    this.drag=null;this.slot=-1;this.boardView?.clearPreview();
    if(!drag)return;
    this.neon.end();
    this.tweens.killTweensOf(drag);
    if(this.delegate.reducedMotion()) {this.boardView.releaseDrag();this.boardView.slotVisible(slot,true);}
    else {
      this.finishReturn();this.returning=drag;this.returningSlot=slot;
      this.tweens.add({targets:drag,...this.boardView.trayHome(slot),duration:DRAG.returnDurationMs,ease:'Sine.Out',onComplete:()=>this.finishReturn()});
    }
  }
  private finishReturn():void{
    if(!this.returning)return;
    const returning=this.returning,slot=this.returningSlot;this.returning=null;this.returningSlot=-1;
    this.tweens.killTweensOf(returning);this.boardView.releaseDrag();this.boardView.slotVisible(slot,true);
  }
  private key=(event:KeyboardEvent):void=>{
    if(!this.delegate.canInteract()||event.target instanceof HTMLButtonElement||event.target instanceof HTMLSelectElement||event.target instanceof HTMLInputElement)return;
    if(this.controls.dragging&&event.key!=='Escape')return;
    if(/^[123]$/.test(event.key)){
      event.preventDefault();const slot=Number(event.key)-1;
      if(!this.delegate.state.tray[slot])return;
      this.begin(slot,{...this.boardView.trayHome(slot),column:0,row:0});this.keyboardCell=this.delegate.isTutorial()?{x:5,y:6}:{x:0,y:0};
    }else if(event.key==='Escape'){this.cancel();return;}
    else if(this.drag&&event.key==='Enter'){event.preventDefault();this.drop(this.keyboardCell.x,this.keyboardCell.y);return;}
    else if(this.drag&&event.key.startsWith('Arrow')){
      event.preventDefault();this.keyboardCell.x=Math.max(0,Math.min(7,this.keyboardCell.x+(event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0)));
      this.keyboardCell.y=Math.max(0,Math.min(7,this.keyboardCell.y+(event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0)));
    }else return;
    if(this.drag){const piece=this.delegate.state.tray[this.slot]!,s=getShape(piece.shapeId),{x,y}=this.keyboardCell;this.move({x:GRID.x+(x+s.width/2)*GRID.cell,y:GRID.y+(y+s.height/2)*GRID.cell,scale:1,column:x,row:y});}
  };
}
