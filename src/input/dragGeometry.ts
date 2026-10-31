import { GRID, VIEW } from '../config/layout';
import { DRAG } from '../config/controls';
import type { Shape } from '../core/types';

export interface Point { x: number; y: number }
export interface CanvasRect { left: number; top: number; width: number; height: number }
export interface PieceTransform extends Point { scale: number }
export interface Grip {
  shape: Shape;
  contact: Point;
  initialScale: number;
  lift: number;
}
export interface DragPose extends PieceTransform { column: number; row: number }

export function clientToWorld(point: Point, rect: CanvasRect): Point {
  return { x: (point.x-rect.left)*VIEW.width/rect.width, y: (point.y-rect.top)*VIEW.height/rect.height };
}

/** Distance to the actual visible cells, in CSS pixels. Holes are not hitboxes. */
export function pieceHitDistance(point: Point, shape: Shape, transform: PieceTransform, rect: CanvasRect): number {
  const halfBlock=(GRID.cell-3)*transform.scale/2;
  let distance=Infinity;
  for (const [cx,cy] of shape.cells) {
    const x=transform.x+(cx-(shape.width-1)/2)*GRID.cell*transform.scale;
    const y=transform.y+(cy-(shape.height-1)/2)*GRID.cell*transform.scale;
    const dx=Math.max(0,Math.abs(point.x-x)-halfBlock)*rect.width/VIEW.width;
    const dy=Math.max(0,Math.abs(point.y-y)-halfBlock)*rect.height/VIEW.height;
    distance=Math.min(distance,Math.hypot(dx,dy));
  }
  return distance;
}

export function createGrip(point: Point, shape: Shape, transform: PieceTransform, touch: boolean, rect: CanvasRect): Grip {
  const contact={x:(point.x-transform.x)/transform.scale,y:(point.y-transform.y)/transform.scale};
  const clearance=DRAG.touchClearanceCss*VIEW.height/rect.height;
  // Lift enough to put the bottom edge above the finger. Large/tall shapes need more lift.
  const lift=touch?Math.max(clearance,(shape.height*GRID.cell/2-contact.y)*DRAG.targetScale+clearance):0;
  return {shape,contact,initialScale:transform.scale,lift};
}

export function poseAt(point: Point, grip: Grip, progress: number): DragPose {
  const eased=1-(1-Math.max(0,Math.min(1,progress)))**3;
  const scale=grip.initialScale+(DRAG.targetScale-grip.initialScale)*eased;
  const x=point.x-grip.contact.x*scale;
  const y=point.y-grip.contact.y*scale-grip.lift*eased;
  return {
    x,y,scale,
    column:Math.round((x-GRID.x-grip.shape.width*GRID.cell/2)/GRID.cell),
    row:Math.round((y-GRID.y-grip.shape.height*GRID.cell/2)/GRID.cell),
  };
}
