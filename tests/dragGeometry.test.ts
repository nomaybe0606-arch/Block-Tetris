import { describe, expect, it } from 'vitest';
import { GRID, TRAY, VIEW } from '../src/config/layout';
import { DRAG } from '../src/config/controls';
import { canPlace, emptyBoard } from '../src/core/board';
import { getShape } from '../src/core/shapes';
import { clientToWorld, createGrip, createZoneGrip, trayPickupSlot, pieceHitDistance, poseAt } from '../src/input/dragGeometry';

const rect={left:100,top:50,width:360,height:637.5};
const transform={x:TRAY.centers[0],y:TRAY.y,scale:TRAY.scale};
describe('contact-preserving pickup',()=>{
  it('gives every pixel under the board exactly one column, including the dividing lines',()=>{
    for(let x=0;x<480;x++){const slot=trayPickupSlot({x,y:TRAY.pickupTop});expect(slot).toBeGreaterThanOrEqual(0);expect(slot).toBeLessThan(3);}
    expect(trayPickupSlot({x:171,y:700})).toBe(1);expect(trayPickupSlot({x:309,y:700})).toBe(2);
  });
  it.each([.5,.75,1,1.5])('keeps remote pickup continuous and finger clearance constant at CSS scale %s',scale=>{
    const shape=getShape('square-3'),point={x:40,y:TRAY.pickupBottom-1},screen={left:0,top:0,width:480*scale,height:850*scale};
    const grip=createZoneGrip(point,shape,transform,true,screen),initial=poseAt(point,grip,0),full=poseAt(point,grip,1);
    expect(initial).toMatchObject(transform);expect(full.x).toBe(point.x);expect((point.y-full.y-shape.height*52/2)*scale).toBeCloseTo(22);
    for(const p of [0,.25,.5,.75,1]){const a=poseAt(point,grip,p),b=poseAt({x:point.x+50,y:point.y-100},grip,p);expect(b.x-a.x).toBeCloseTo(50);expect(b.y-a.y).toBeCloseTo(-100);}
  });
  it.each(['single','line-5-h','line-5-v','square-3','L-0','T-0'])('%s preserves both edge contacts during growth and lift',id=>{
    const shape=getShape(id);
    for(const cell of [shape.cells[0],shape.cells[shape.cells.length-1]])for(const touch of [false,true]){
      const point={x:transform.x+(cell[0]-(shape.width-1)/2)*GRID.cell*TRAY.scale,y:transform.y+(cell[1]-(shape.height-1)/2)*GRID.cell*TRAY.scale};
      const grip=createGrip(point,shape,transform,touch,rect);
      expect(pieceHitDistance(point,shape,transform,rect)).toBe(0);
      expect(poseAt(point,grip,0).x).toBeCloseTo(transform.x);expect(poseAt(point,grip,0).y).toBeCloseTo(transform.y);
      for(const progress of [0,.25,.6,1]){
        const pose=poseAt(point,grip,progress),lift=grip.lift*(1-(1-progress)**3);
        expect(pose.x+grip.contact.x*pose.scale).toBeCloseTo(point.x);
        expect(pose.y+grip.contact.y*pose.scale+lift).toBeCloseTo(point.y);
      }
      const full=poseAt(point,grip,1);
      if(touch)expect((point.y-(full.y+shape.height*GRID.cell/2))*rect.height/VIEW.height).toBeGreaterThanOrEqual(DRAG.touchClearanceCss-1e-8);
      else expect(grip.lift).toBe(0);
    }
  });
  it('does not recenter a piece held by its rightmost cell',()=>{
    const shape=getShape('line-3-h'),point={x:transform.x+GRID.cell*TRAY.scale,y:transform.y};
    const grip=createGrip(point,shape,transform,false,rect),pose=poseAt(point,grip,1);
    expect(pose.x).toBeCloseTo(point.x-GRID.cell);expect(pose.x).not.toBeCloseTo(point.x);
  });
  it('uses the rendered tray scale even during its appearance animation',()=>{
    const shown={...transform,scale:.43},shape=getShape('square-3'),point={x:shown.x+52*.43,y:shown.y+52*.43};
    expect(poseAt(point,createGrip(point,shape,shown,false,rect),0)).toMatchObject({x:shown.x,y:shown.y,scale:shown.scale});
  });
  it('does not turn a polyomino hole into a rectangular hit area',()=>{
    const shape=getShape('T-0');
    const hole={x:transform.x-52*TRAY.scale,y:transform.y+26*TRAY.scale};
    expect(pieceHitDistance(hole,shape,transform,rect)).toBeGreaterThan(DRAG.mouseHitSlopCss);
  });
});
describe('CSS scaling, DPR independence and board boundaries',()=>{
  it.each([.5,2/3,.75,1,1.5])('maps client coordinates at CSS scale %s',scale=>{
    const screen={left:37,top:91,width:VIEW.width*scale,height:VIEW.height*scale};
    const world=clientToWorld({x:37+370*scale,y:91+568*scale},screen);
    expect(world.x).toBeCloseTo(370);expect(world.y).toBeCloseTo(568);
    const shape=getShape('square-3'),point={x:102,y:736};
    const pose=poseAt(point,createGrip(point,shape,transform,true,screen),1);
    expect((point.y-pose.y-shape.height*GRID.cell/2)*scale).toBeCloseTo(DRAG.touchClearanceCss);
  });
  it.each(['single','line-5-h','line-5-v','square-3','L-0','T-0'])('%s previews and fits exactly at all four edges',id=>{
    const shape=getShape(id),grip=createGrip({x:102,y:TRAY.y},shape,transform,false,rect);
    for(const [column,row] of [[0,0],[8-shape.width,0],[0,8-shape.height],[8-shape.width,8-shape.height]]){
      const point={x:GRID.x+(column+shape.width/2)*GRID.cell,y:GRID.y+(row+shape.height/2)*GRID.cell};
      const pose=poseAt(point,grip,1);
      expect([pose.column,pose.row]).toEqual([column,row]);expect(canPlace(emptyBoard(),shape,pose.column,pose.row)).toBe(true);
    }
    for(const [column,row] of [[-1,0],[0,-1],[9-shape.width,0],[0,9-shape.height]]){
      const pose=poseAt({x:GRID.x+(column+shape.width/2)*52,y:GRID.y+(row+shape.height/2)*52},grip,1);
      expect(canPlace(emptyBoard(),shape,pose.column,pose.row)).toBe(false);
    }
  });
});
