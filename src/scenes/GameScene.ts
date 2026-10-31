import Phaser from 'phaser';
import { GRID, TRAY } from '../config/layout';
import { DRAG } from '../config/controls';
import { FEEDBACK } from '../config/feedback';
import { canPlace, cloneBoard } from '../core/board';
import { getShape } from '../core/shapes';
import type { GameState, Placement } from '../core/types';
import { DragController } from '../input/DragController';
import type { DragPose } from '../input/dragGeometry';
import { BoardRenderer } from '../rendering/BoardRenderer';
import { Feedback } from '../rendering/Feedback';
import { createTextures } from '../rendering/textures';

export interface SceneDelegate {
  state: GameState; reducedMotion(): boolean; pixelRatio(): number; canInteract(): boolean; isTutorial(): boolean;
  onPlace(slot: number,x: number,y: number): Placement | null;
  onPick(): void; onClearFeedback(result: Placement): void; onSettled(): void; onReady(scene: GameScene): void;
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
  private locked = false;
  constructor(delegate: SceneDelegate) { super('Classic');this.delegate=delegate; }
  create(): void {
    this.cameras.main.setZoom(this.delegate.pixelRatio()).centerOn(240,425);
    createTextures(this);
    this.boardView=new BoardRenderer(this);this.feedback=new Feedback(this);
    this.controls=new DragController(this.game.canvas,{
      enabled:()=>this.delegate.canInteract()&&!this.locked,
      getPiece:slot=>{
        const piece=this.delegate.state.tray[slot],transform=this.boardView.trayTransform(slot);
        return piece&&transform?{piece,shape:getShape(piece.shapeId),transform}:null;
      },
      reducedMotion:()=>this.delegate.reducedMotion(),
      preparePickup:()=>{this.cancelDrag();this.finishReturn();},
      begin:(slot,pose)=>this.begin(slot,pose),move:pose=>this.move(pose),end:(c,r)=>this.drop(c,r),cancel:()=>this.cancelDrag(),
    });
    window.addEventListener('keydown',this.key);
    this.events.once('shutdown',()=>{this.controls.destroy();window.removeEventListener('keydown',this.key);});
    this.delegate.onReady(this);
  }
  show(visible: boolean): void { this.boardView.root.setVisible(visible); if(!visible) {this.cancel();this.finishReturn();} }
  refresh(animate = false): void {
    this.finishReturn();
    this.boardView.render(this.delegate.state.board);
    this.boardView.renderTray(this.delegate.state,this.delegate.reducedMotion(),animate);
    this.boardView.showTutorial(this.delegate.isTutorial());
  }
  cancel(): void { this.controls?.cancel();this.cancelDrag(); }
  update():void{this.controls?.update();}
  private begin(slot:number,pose:DragPose): void {
    this.cancelDrag();this.finishReturn();const piece=this.delegate.state.tray[slot];if(!piece)return;
    this.slot=slot;this.boardView.slotVisible(slot,false);
    this.drag=this.boardView.piece(piece,getShape(piece.shapeId)).setPosition(pose.x,pose.y).setDepth(30).setScale(pose.scale).setAlpha(.96);
    this.delegate.onPick();
  }
  private move({x,y,scale,column,row}:DragPose): void {
    if(!this.drag)return;
    const piece=this.delegate.state.tray[this.slot];if(!piece)return;
    const allowed=!this.delegate.isTutorial()||(column===5&&row===6);
    const valid=this.boardView.showPreview(this.delegate.state.board,getShape(piece.shapeId),column,row,allowed);
    this.drag.setPosition(x,y).setScale(scale).setAlpha(valid?0.98:0.86);
  }
  private drop(x:number,y:number): void {
    const slot=this.slot,piece=this.delegate.state.tray[slot];
    if(!piece)return this.cancelDrag();
    const valid=canPlace(this.delegate.state.board,getShape(piece.shapeId),x,y)&&(!this.delegate.isTutorial()||(x===5&&y===6));
    if(!valid)return this.cancelDrag();
    const previous=cloneBoard(this.delegate.state.board);
    this.drag?.destroy();this.drag=null;this.slot=-1;this.boardView.clearPreview();
    const result=this.delegate.onPlace(slot,x,y);
    if(!result) {this.refresh();return;}
    for(const [cx,cy] of result.placed)previous[cy][cx]=piece.color;
    this.boardView.render(previous);this.boardView.showTutorial(false);
    this.boardView.renderTray(result.state,this.delegate.reducedMotion(),result.state.tray.every(Boolean));
    this.feedback.placement(result,piece.color,this.delegate.reducedMotion());
    if(result.cleared.length) {
      this.locked=true;
      const lead=this.delegate.reducedMotion()?0:FEEDBACK.clearLeadMs;
      this.time.delayedCall(lead,()=>{this.delegate.onClearFeedback(result);this.feedback.clear(result,this.delegate.reducedMotion());});
      this.time.delayedCall(lead+(this.delegate.reducedMotion()?FEEDBACK.reducedClearMs:FEEDBACK.clearDurationMs),()=>{this.boardView.render(result.state.board);this.locked=false;this.delegate.onSettled();});
    } else {
      this.feedback.points(result.points,GRID.x+x*52+26,GRID.y+y*52+12,this.delegate.reducedMotion());
      this.boardView.render(result.state.board);this.delegate.onSettled();
    }
  }
  private cancelDrag(): void {
    const drag=this.drag,slot=this.slot;
    this.drag=null;this.slot=-1;this.boardView?.clearPreview();
    if(!drag)return;
    this.tweens.killTweensOf(drag);
    if(this.delegate.reducedMotion()) {drag.destroy();this.boardView.slotVisible(slot,true);}
    else {
      this.finishReturn();this.returning=drag;this.returningSlot=slot;
      this.tweens.add({targets:drag,x:TRAY.centers[slot],y:TRAY.y,scale:TRAY.scale,duration:DRAG.returnDurationMs,ease:'Quad.Out',onComplete:()=>this.finishReturn()});
    }
  }
  private finishReturn():void{
    if(!this.returning)return;
    const returning=this.returning,slot=this.returningSlot;this.returning=null;this.returningSlot=-1;
    this.tweens.killTweensOf(returning);returning.destroy();this.boardView.slotVisible(slot,true);
  }
  private key=(event:KeyboardEvent):void=>{
    if(!this.delegate.canInteract()||this.locked||event.target instanceof HTMLButtonElement||event.target instanceof HTMLSelectElement||event.target instanceof HTMLInputElement)return;
    if(this.controls.dragging&&event.key!=='Escape')return;
    if(/^[123]$/.test(event.key)){
      event.preventDefault();const slot=Number(event.key)-1;
      if(!this.delegate.state.tray[slot])return;
      this.begin(slot,{x:TRAY.centers[slot],y:TRAY.y,scale:TRAY.scale,column:0,row:0});this.keyboardCell=this.delegate.isTutorial()?{x:5,y:6}:{x:0,y:0};
    }else if(event.key==='Escape'){this.cancel();return;}
    else if(this.drag&&event.key==='Enter'){event.preventDefault();this.drop(this.keyboardCell.x,this.keyboardCell.y);return;}
    else if(this.drag&&event.key.startsWith('Arrow')){
      event.preventDefault();this.keyboardCell.x=Math.max(0,Math.min(7,this.keyboardCell.x+(event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0)));
      this.keyboardCell.y=Math.max(0,Math.min(7,this.keyboardCell.y+(event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0)));
    }else return;
    if(this.drag){const piece=this.delegate.state.tray[this.slot]!,s=getShape(piece.shapeId),{x,y}=this.keyboardCell;this.move({x:GRID.x+(x+s.width/2)*GRID.cell,y:GRID.y+(y+s.height/2)*GRID.cell,scale:1,column:x,row:y});}
  };
}
