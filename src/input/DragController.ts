import { DRAG } from '../config/controls';
import type { Piece, Shape } from '../core/types';
import { clientToWorld, createGrip, pieceHitDistance, poseAt, type CanvasRect, type DragPose, type Grip, type PieceTransform, type Point } from './dragGeometry';

export interface DragHost {
  enabled(): boolean;
  getPiece(slot: number): { piece: Piece; shape: Shape; transform: PieceTransform } | null;
  reducedMotion(): boolean;
  preparePickup(): void;
  begin(slot: number, pose: DragPose): void;
  move(pose: DragPose): void;
  end(column: number, row: number): void;
  cancel(): void;
}
interface ActiveDrag { id: number; grip: Grip; rect: CanvasRect; point: Point; started: number; progress: number }
export class DragController {
  private active: ActiveDrag | null = null;
  get dragging(): boolean { return this.active !== null; }
  constructor(private canvas: HTMLCanvasElement, private host: DragHost) {
    canvas.addEventListener('pointerdown',this.down);
    canvas.addEventListener('pointermove',this.move);
    canvas.addEventListener('pointerup',this.up);
    canvas.addEventListener('pointercancel',this.cancel);
    canvas.addEventListener('lostpointercapture',this.cancel);
    window.addEventListener('blur',this.cancel);
    window.addEventListener('resize',this.cancel);
    document.addEventListener('visibilitychange',this.onVisibility);
  }
  private local(event: PointerEvent, rect: CanvasRect) { return clientToWorld({x:event.clientX,y:event.clientY},rect); }
  private down = (event: PointerEvent): void => {
    if(this.active||!this.host.enabled()||event.button!==0) return;
    this.host.preparePickup();
    const rect=this.canvas.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return;
    const point=this.local(event,rect),touch=event.pointerType==='touch';
    const slop=touch?DRAG.touchHitSlopCss:DRAG.mouseHitSlopCss;
    let slot=-1,distance=Infinity,grip:Grip|null=null;
    // Later tray children are on top if two wide shapes overlap.
    for(let i=2;i>=0;i--){
      const data=this.host.getPiece(i);if(!data||data.transform.scale<=0)continue;
      const hit=pieceHitDistance(point,data.shape,data.transform,rect);
      if(hit<=slop&&hit<distance){slot=i;distance=hit;grip=createGrip(point,data.shape,data.transform,touch,rect);}
    }
    if(!grip)return;
    event.preventDefault();
    try{this.canvas.setPointerCapture(event.pointerId);}catch{return;}
    const active:ActiveDrag={id:event.pointerId,grip,rect,point,started:performance.now(),progress:this.host.reducedMotion()?1:0};
    this.active=active;
    const pose=poseAt(point,grip,active.progress);
    this.host.begin(slot,pose);this.host.move(pose);
  };
  /** Called during Phaser update, before the same frame renders preview and dragged cells. */
  update(time=performance.now()):void{
    const active=this.active;if(!active||active.progress>=1)return;
    if(!this.host.enabled()){this.cancel();return;}
    active.progress=this.host.reducedMotion()?1:Math.min(1,Math.max(0,(time-active.started)/DRAG.pickupDurationMs));
    this.host.move(poseAt(active.point,active.grip,active.progress));
  }
  private move = (event: PointerEvent): void => {
    if(!this.active||event.pointerId!==this.active.id) return;
    if(!this.host.enabled()) {this.cancel();return;}
    event.preventDefault();this.active.point=this.local(event,this.active.rect);
    // Pointer motion is applied immediately, even while the pickup animation is running.
    this.host.move(poseAt(this.active.point,this.active.grip,this.active.progress));
  };
  private up = (event: PointerEvent): void => {
    if(!this.active||event.pointerId!==this.active.id) return;
    const active=this.active;this.active=null;
    // Use the same rendered pickup progress, not a new invisible animation state at release.
    const pose=poseAt(this.local(event,active.rect),active.grip,active.progress);
    try{
      if(this.host.enabled()){this.host.move(pose);this.host.end(pose.column,pose.row);}else this.host.cancel();
    }finally{if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);}
  };
  cancel = (event?: Event): void => {
    if(!this.active) return;
    if(event&&'pointerId' in event&&(event as PointerEvent).pointerId!==this.active.id)return;
    const id=this.active.id;this.active=null;this.host.cancel();
    if(this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  };
  private onVisibility = (): void => { if(document.hidden) this.cancel(); };
  destroy(): void {
    this.cancel(); this.canvas.removeEventListener('pointerdown',this.down); this.canvas.removeEventListener('pointermove',this.move);
    this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('pointercancel',this.cancel);this.canvas.removeEventListener('lostpointercapture',this.cancel);
    window.removeEventListener('blur',this.cancel);window.removeEventListener('resize',this.cancel);document.removeEventListener('visibilitychange',this.onVisibility);
  }
}
