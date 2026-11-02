import { GRID, TRAY } from '../config/layout';
import type { Shape } from '../core/types';
import type { PieceTransform } from '../input/dragGeometry';

export const TRAY_AREA={top:684,bottom:794,width:128,padding:8};
/** Fit the complete figure with room for highlights, inside its own slot. */
export function trayTransformFor(shape:Shape,slot:number,reserveSwapSpace=false):PieceTransform{
  const preferred=reserveSwapSpace?.52:TRAY.scale;
  const width=TRAY_AREA.width-TRAY_AREA.padding*2,height=TRAY_AREA.bottom-TRAY_AREA.top-TRAY_AREA.padding*2;
  const scale=Math.min(preferred,width/(shape.width*GRID.cell*1.05),height/(shape.height*GRID.cell*1.05));
  return {x:TRAY.centers[slot],y:(TRAY_AREA.top+TRAY_AREA.bottom)/2,scale};
}
