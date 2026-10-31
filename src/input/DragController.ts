import { GRID, TRAY, VIEW } from '../config/layout';
import type { Piece, Shape } from '../core/types';

export interface DragHost {
  enabled(): boolean;
  getPiece(slot: number): { piece: Piece; shape: Shape } | null;
  begin(slot: number, x: number, y: number): void;
  move(x: number, y: number, column: number, row: number): void;
  end(column: number, row: number): void;
  cancel(): void;
}
export function pointerAnchor(x: number, y: number, shape: Shape, touch: boolean) {
  const centerY = y - (touch ? 88 : 0);
  return { x, y: centerY, column: Math.round((x-GRID.x-shape.width*52/2)/52), row: Math.round((centerY-GRID.y-shape.height*52/2)/52) };
}
export class DragController {
  private active: { id: number; shape: Shape; touch: boolean } | null = null;
  get dragging(): boolean { return this.active !== null; }
  constructor(private canvas: HTMLCanvasElement, private host: DragHost) {
    canvas.addEventListener('pointerdown',this.down);
    canvas.addEventListener('pointermove',this.move);
    canvas.addEventListener('pointerup',this.up);
    canvas.addEventListener('pointercancel',this.cancel);
    canvas.addEventListener('lostpointercapture',this.cancel);
    window.addEventListener('blur',this.cancel);
    document.addEventListener('visibilitychange',this.onVisibility);
  }
  private local(event: PointerEvent) { const r=this.canvas.getBoundingClientRect(); return { x:(event.clientX-r.left)*VIEW.width/r.width,y:(event.clientY-r.top)*VIEW.height/r.height }; }
  private down = (event: PointerEvent): void => {
    if(this.active||!this.host.enabled()||event.button!==0) return;
    const {x,y}=this.local(event);
    if(y<677||y>802) return;
    const slot=TRAY.centers.findIndex(cx=>Math.abs(cx-x)<65), data=this.host.getPiece(slot);
    if(!data) return;
    event.preventDefault();
    this.active={id:event.pointerId,shape:data.shape,touch:event.pointerType!=='mouse'};
    this.canvas.setPointerCapture(event.pointerId);
    const anchor=pointerAnchor(x,y,data.shape,this.active.touch);
    this.host.begin(slot,TRAY.centers[slot],TRAY.y);
    this.host.move(anchor.x,anchor.y,anchor.column,anchor.row);
  };
  private move = (event: PointerEvent): void => {
    if(!this.active||event.pointerId!==this.active.id) return;
    if(!this.host.enabled()) {this.cancel();return;}
    event.preventDefault(); const {x,y}=this.local(event), a=pointerAnchor(x,y,this.active.shape,this.active.touch);
    this.host.move(a.x,a.y,a.column,a.row);
  };
  private up = (event: PointerEvent): void => {
    if(!this.active||event.pointerId!==this.active.id) return;
    const active=this.active; this.active=null;
    const {x,y}=this.local(event),a=pointerAnchor(x,y,active.shape,active.touch);
    if(this.host.enabled()) this.host.end(a.column,a.row); else this.host.cancel();
    if(this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };
  cancel = (): void => {
    if(!this.active) return;
    const id=this.active.id;this.active=null;this.host.cancel();
    if(this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  };
  private onVisibility = (): void => { if(document.hidden) this.cancel(); };
  destroy(): void {
    this.cancel(); this.canvas.removeEventListener('pointerdown',this.down); this.canvas.removeEventListener('pointermove',this.move);
    this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('pointercancel',this.cancel);this.canvas.removeEventListener('lostpointercapture',this.cancel);
    window.removeEventListener('blur',this.cancel);document.removeEventListener('visibilitychange',this.onVisibility);
  }
}
