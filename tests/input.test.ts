import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DragController, type DragHost } from '../src/input/DragController';
import { getShape } from '../src/core/shapes';
import { GRID, TRAY, VIEW } from '../src/config/layout';
import { DRAG } from '../src/config/controls';
import { createGrip, poseAt, type DragPose } from '../src/input/dragGeometry';

class FakeCanvas extends EventTarget {
  onpointerrawupdate=null;
  captured=new Set<number>();
  rect={left:100,top:50,width:240,height:425};
  width=480; height=850;
  setPointerCapture(id:number){this.captured.add(id);}
  hasPointerCapture(id:number){return this.captured.has(id);}
  releasePointerCapture(id:number){this.captured.delete(id);}
  getBoundingClientRect(){return this.rect;}
  pointer(type:string,x:number,y:number,extra:Record<string,unknown>={}){
    const event=new Event(type,{cancelable:true});
    Object.assign(event,{pointerId:1,button:0,pointerType:'mouse',clientX:this.rect.left+x*this.rect.width/VIEW.width,clientY:this.rect.top+y*this.rect.height/VIEW.height,...extra});
    this.dispatchEvent(event);
  }
}
let now=0;
const targetY=GRID.y+6*GRID.cell+GRID.cell/2;
let controllers:DragController[];
beforeEach(()=>{
  vi.restoreAllMocks();now=0;controllers=[];
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',Object.assign(new EventTarget(),{hidden:false}));
  vi.spyOn(performance,'now').mockImplementation(()=>now);
});
function frame(time:number){now=time;for(const controller of controllers)controller.update(time);}
function setup(shapeId='line-3-h'){
  const canvas=new FakeCanvas(),shape=getShape(shapeId),transform={x:TRAY.centers[0],y:TRAY.y,scale:TRAY.scale};
  const host={
    enabled:vi.fn(()=>true),reducedMotion:vi.fn(()=>false),preparePickup:vi.fn(),
    getPiece:vi.fn((slot:number)=>slot===0?{piece:{shapeId,color:2},shape,transform}:null),
    begin:vi.fn(),move:vi.fn(),end:vi.fn(),cancel:vi.fn(),
  } satisfies DragHost;
  const controller=new DragController(canvas as unknown as HTMLCanvasElement,host);
  controllers.push(controller);
  const preview=()=>host.move.mock.calls.at(-1)![0] as DragPose;
  return {canvas,host,controller,shape,transform,preview};
}
describe('immediate input and preview/drop agreement',()=>{
  it.each(['mouse','touch'])('commits a fast %s drag without waiting for any animation frame',pointerType=>{
    const {canvas,host,preview}=setup();
    canvas.pointer('pointerdown',102,TRAY.y,{pointerType});
    canvas.pointer('pointermove',370,targetY,{pointerType});
    expect(preview()).toMatchObject({x:370,y:targetY,column:5,row:6,scale:TRAY.scale});
    canvas.pointer('pointerup',370,targetY,{pointerType});canvas.pointer('lostpointercapture',370,targetY);
    expect(host.end).toHaveBeenCalledExactlyOnceWith(5,6);expect(host.cancel).not.toHaveBeenCalled();expect(canvas.captured.size).toBe(0);
    const moves=host.move.mock.calls.length;frame(100);expect(host.move).toHaveBeenCalledTimes(moves);
  });
  it('moves directly by the complete pointer delta during the pickup animation',()=>{
    const {canvas,preview}=setup();canvas.pointer('pointerdown',102,736);frame(40);
    const before=preview();canvas.pointer('pointermove',302,436);
    expect(preview().x-before.x).toBeCloseTo(200);expect(preview().y-before.y).toBeCloseTo(-300);expect(preview().scale).toBe(before.scale);
  });
  it('keeps the last rendered pickup progress at release, even if time has advanced',()=>{
    const {canvas,host,preview}=setup();canvas.pointer('pointerdown',102,736,{pointerType:'touch'});frame(25);
    canvas.pointer('pointermove',370,610);const shown=preview();now=99;
    canvas.pointer('pointerup',370,610);expect(preview()).toEqual(shown);expect(host.end).toHaveBeenCalledExactlyOnceWith(shown.column,shown.row);
  });
  it('uses final pointer coordinates when release arrives without a final move',()=>{
    const {canvas,host,preview}=setup();canvas.pointer('pointerdown',102,736);canvas.pointer('pointermove',318,568);canvas.pointer('pointerup',370,568);
    expect(preview()).toMatchObject({x:370,column:5,row:6});expect(host.end).toHaveBeenCalledExactlyOnceWith(5,6);
  });
  it.each([1,2,3])('is independent of backing-buffer DPR %s',dpr=>{
    const {canvas,host}=setup();canvas.width=480*dpr;canvas.height=850*dpr;canvas.rect={left:37,top:91,width:320,height:850*2/3};
    canvas.pointer('pointerdown',102,TRAY.y);frame(100);canvas.pointer('pointerup',370,targetY);expect(host.end).toHaveBeenCalledExactlyOnceWith(5,6);
  });
  it('uses mouse contact without finger lift and finishes touch pickup with CSS clearance',()=>{
    const mouse=setup();mouse.canvas.pointer('pointerdown',102,TRAY.y);frame(100);expect(mouse.preview().y).toBe(TRAY.y);mouse.controller.destroy();
    const touch=setup();touch.canvas.pointer('pointerdown',102,TRAY.y,{pointerType:'touch'});frame(200);
    expect((TRAY.y-touch.preview().y-26)*touch.canvas.rect.height/850).toBeCloseTo(DRAG.touchClearanceCss);
  });
  it.each(['line-5-h','line-5-v','square-3','L-0','T-0'])('%s picked at an end previews and drops at the bottom-right boundary',id=>{
    const {canvas,host,shape,transform,preview}=setup(id),cell=shape.cells.at(-1)!;
    const contact={x:transform.x+(cell[0]-(shape.width-1)/2)*52*TRAY.scale,y:transform.y+(cell[1]-(shape.height-1)/2)*52*TRAY.scale};
    const grip=createGrip(contact,shape,transform,true,canvas.rect);
    canvas.pointer('pointerdown',contact.x,contact.y,{pointerType:'touch'});frame(100);
    const column=8-shape.width,row=8-shape.height;
    const finger={x:GRID.x+(column+shape.width/2)*52+grip.contact.x,y:GRID.y+(row+shape.height/2)*52+grip.contact.y+grip.lift};
    canvas.pointer('pointermove',finger.x,finger.y,{pointerType:'touch'});
    const expected=poseAt(finger,grip,1);expect(preview().x).toBeCloseTo(expected.x);expect(preview().y).toBeCloseTo(expected.y);expect([preview().column,preview().row]).toEqual([column,row]);
    canvas.pointer('pointerup',finger.x,finger.y,{pointerType:'touch'});expect(host.end).toHaveBeenCalledExactlyOnceWith(column,row);
  });
  it('applies Reduced Motion instantly, with the same contact model',()=>{
    const {canvas,host,preview}=setup();host.reducedMotion.mockReturnValue(true);
    canvas.pointer('pointerdown',102,736,{pointerType:'touch'});expect(preview().scale).toBe(1);expect(preview().y).toBeLessThan(736);
    frame(50);expect(host.move).toHaveBeenCalledTimes(1);
  });
});
describe('hit testing, capture, and cancellation',()=>{
  it.each([0,1,2])('picks slot %s anywhere between the board edge and the lower controls',slot=>{
    const s=setup('single'),shape=getShape('single'),transform={x:TRAY.centers[slot],y:TRAY.y,scale:.59};
    s.host.getPiece.mockImplementation(index=>index===slot?{piece:{shapeId:shape.id,color:2},shape,transform}:null);
    for(const y of [TRAY.pickupTop,TRAY.pickupTop+8,TRAY.y+60,TRAY.pickupBottom-1]){
      s.canvas.pointer('pointerdown',TRAY.centers[slot],y,{pointerType:'touch'});
      expect(s.host.begin.mock.calls.at(-1)?.[0]).toBe(slot);expect(s.preview().x).toBe(transform.x);expect(s.preview().y).toBe(transform.y);
      s.canvas.pointer('pointercancel',0,0);
    }
    expect(s.host.begin).toHaveBeenCalledTimes(4);
  });
  it('never steals a board touch, a lower-control touch or a touch outside the canvas',()=>{
    const s=setup('single');for(const [x,y] of [[102,TRAY.pickupTop-1],[102,TRAY.pickupBottom],[102,860],[-1,750],[480,750]])s.canvas.pointer('pointerdown',x,y,{pointerType:'touch'});
    expect(s.host.begin).not.toHaveBeenCalled();
  });
  it('reserves the lower button area only when the control is present',()=>{
    const s=setup('single');Object.assign(s.host,{pickupBottom:()=>TRAY.controlsTop});
    s.canvas.pointer('pointerdown',102,TRAY.controlsTop,{pointerType:'touch'});s.canvas.pointer('pointerdown',102,820,{pointerType:'touch'});expect(s.host.begin).not.toHaveBeenCalled();
    s.canvas.pointer('pointerdown',102,TRAY.controlsTop-1,{pointerType:'touch'});expect(s.host.begin).toHaveBeenCalledTimes(1);
  });
  it('does not select a neighbour when the touched column has been used',()=>{
    const s=setup('single');s.canvas.pointer('pointerdown',TRAY.centers[1],TRAY.pickupBottom-1,{pointerType:'touch'});expect(s.host.begin).not.toHaveBeenCalled();
    s.canvas.pointer('pointerdown',TRAY.centers[0],TRAY.pickupBottom-1,{pointerType:'touch'});expect(s.host.begin).toHaveBeenCalledTimes(1);
  });
  it('keeps adjacent columns separate even if slop would reach the neighbouring piece',()=>{
    const s=setup('single');s.host.getPiece.mockImplementation(slot=>slot===0?{piece:{shapeId:'single',color:2},shape:getShape('single'),transform:{x:170,y:TRAY.y,scale:.59}}:null);
    s.canvas.pointer('pointerdown',172,TRAY.y,{pointerType:'touch'});expect(s.host.begin).not.toHaveBeenCalled();
  });
  it('moves a remotely grabbed figure immediately by the entire pointer delta before the first frame',()=>{
    const s=setup('square-3'),downY=TRAY.pickupBottom-1;s.canvas.pointer('pointerdown',102,downY,{pointerType:'touch'});const before=s.preview();
    s.canvas.pointer('pointermove',302,downY-300,{pointerType:'touch'});expect(s.preview().x-before.x).toBe(200);expect(s.preview().y-before.y).toBe(-300);
    const shown=s.preview();s.canvas.pointer('pointerup',302,downY-300,{pointerType:'touch'});expect(s.host.end).toHaveBeenCalledExactlyOnceWith(shown.column,shown.row);
  });
  it('remotely picks a tall figure without exaggerated off-center lift and preserves preview/drop',()=>{
    const s=setup('line-5-v');s.canvas.pointer('pointerdown',50,TRAY.pickupBottom-1,{pointerType:'touch'});frame(100);
    expect(s.preview().x).toBe(50);expect((TRAY.pickupBottom-1-s.preview().y-5*52/2)*s.canvas.rect.height/850).toBeCloseTo(DRAG.touchClearanceCss);
    s.canvas.pointer('pointermove',320,600,{pointerType:'touch'});const shown=s.preview();s.canvas.pointer('pointerup',320,600,{pointerType:'touch'});expect(s.host.end).toHaveBeenCalledExactlyOnceWith(shown.column,shown.row);
  });
  it('allows a second remote pickup immediately after a quick release',()=>{
    const s=setup('single');for(let i=0;i<2;i++){s.canvas.pointer('pointerdown',102,TRAY.pickupBottom-1,{pointerType:'touch'});s.canvas.pointer('pointerup',102,TRAY.pickupBottom-1,{pointerType:'touch'});}
    expect(s.host.begin).toHaveBeenCalledTimes(2);expect(s.host.cancel).toHaveBeenCalledTimes(2);expect(s.host.end).not.toHaveBeenCalled();expect(s.canvas.captured.size).toBe(0);
  });
  it('does not place from a stationary remote tap even if its lift reaches the board',()=>{
    const s=setup('single');s.canvas.pointer('pointerdown',102,TRAY.pickupTop,{pointerType:'touch'});frame(100);s.canvas.pointer('pointerup',102,TRAY.pickupTop,{pointerType:'touch'});
    expect(s.host.end).not.toHaveBeenCalled();expect(s.host.cancel).toHaveBeenCalledTimes(1);expect(s.canvas.captured.size).toBe(0);
  });
  it('starts the remote drag immediately while rejecting only tiny finger jitter on release',()=>{
    const s=setup('single');s.canvas.pointer('pointerdown',102,TRAY.pickupTop,{pointerType:'touch'});const initial=s.preview();
    s.canvas.pointer('pointermove',104,TRAY.pickupTop-2,{pointerType:'touch'});expect(s.preview().x-initial.x).toBe(2);
    s.canvas.pointer('pointerup',104,TRAY.pickupTop-2,{pointerType:'touch'});expect(s.host.end).not.toHaveBeenCalled();expect(s.host.cancel).toHaveBeenCalledTimes(1);
  });
  it('also accepts empty space in the column of a single-cell piece',()=>{
    const {canvas,host}=setup('single');canvas.pointer('pointerdown',150,TRAY.y,{pointerType:'touch'});expect(host.begin).toHaveBeenCalledTimes(1);
  });
  it('can pick the top of a tall tray piece, outside the former fixed tray bounds',()=>{
    const {canvas,host}=setup('line-5-v');canvas.pointer('pointerdown',102,736-104*TRAY.scale);expect(host.begin).toHaveBeenCalledTimes(1);
  });
  it.each(['pointercancel','lostpointercapture'])('%s cancels once, removes animation and releases capture',type=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);canvas.pointer(type,0,0);canvas.pointer('pointerup',370,568);frame(100);
    expect(host.cancel).toHaveBeenCalledTimes(1);expect(host.end).not.toHaveBeenCalled();expect(canvas.captured.size).toBe(0);expect(host.move).toHaveBeenCalledTimes(1);
  });
  it.each(['blur','resize'])('%s cancels the gesture and allows immediate pickup again',type=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);if(type==='resize')canvas.rect={...canvas.rect,width:300};window.dispatchEvent(new Event(type));canvas.pointer('pointerdown',102,736);
    expect(host.cancel).toHaveBeenCalledTimes(1);expect(host.begin).toHaveBeenCalledTimes(2);
  });
  it('keeps a gesture through duplicate resize notifications with unchanged bounds',()=>{
    const {canvas,host,controller}=setup();canvas.pointer('pointerdown',102,736,{pointerType:'touch'});
    for(let i=0;i<10;i++)window.dispatchEvent(new Event('resize'));
    expect(controller.dragging).toBe(true);expect(host.cancel).not.toHaveBeenCalled();canvas.pointer('pointerup',370,568);expect(host.end).toHaveBeenCalledTimes(1);
  });
  it('accepts raw pointer updates when available and removes that listener on destroy',()=>{
    const {canvas,preview,controller,host}=setup();canvas.pointer('pointerdown',102,736);frame(100);
    canvas.pointer('pointerrawupdate',310,510);expect(preview().x).toBe(310);expect(preview().y).toBe(510);
    controller.destroy();const count=host.move.mock.calls.length;canvas.pointer('pointerrawupdate',400,600);expect(host.move).toHaveBeenCalledTimes(count);
  });
  it('uses the newest coalesced position directly and advances pickup after a missed render',()=>{
    const {canvas,preview,host}=setup();canvas.pointer('pointerdown',102,736,{pointerType:'touch'});frame(20);now=100;
    canvas.pointer('pointermove',150,650,{getCoalescedEvents:()=>[{clientX:canvas.rect.left+200*canvas.rect.width/480,clientY:canvas.rect.top+600*canvas.rect.height/850},{clientX:canvas.rect.left+300*canvas.rect.width/480,clientY:canvas.rect.top+500*canvas.rect.height/850}]});
    expect(preview().x).toBe(300);expect(preview().scale).toBe(1);const shown=preview();
    canvas.pointer('pointerup',300,500);expect(preview()).toEqual(shown);expect(host.end).toHaveBeenCalledExactlyOnceWith(shown.column,shown.row);
  });
  it('ignores a second pointer, including its cancel and lost-capture events',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);canvas.pointer('pointerdown',102,736,{pointerId:2});canvas.pointer('pointercancel',0,0,{pointerId:2});canvas.pointer('lostpointercapture',0,0,{pointerId:2});canvas.pointer('pointerup',370,568,{pointerId:2});
    expect(host.cancel).not.toHaveBeenCalled();expect(host.end).not.toHaveBeenCalled();canvas.pointer('pointerup',370,568);expect(host.end).toHaveBeenCalledTimes(1);expect(host.begin).toHaveBeenCalledTimes(1);
  });
  it('cancels if input becomes disabled before release or a pickup frame',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);host.enabled.mockReturnValue(false);frame(50);canvas.pointer('pointerup',370,568);expect(host.cancel).toHaveBeenCalledTimes(1);expect(host.end).not.toHaveBeenCalled();
  });
  it('cancels when hidden and removes all callbacks on destroy',()=>{
    const {canvas,host,controller}=setup();canvas.pointer('pointerdown',102,736);Object.assign(document,{hidden:true});document.dispatchEvent(new Event('visibilitychange'));expect(host.cancel).toHaveBeenCalledTimes(1);expect(controller.dragging).toBe(false);
    controller.destroy();canvas.pointer('pointerdown',102,736);frame(100);expect(host.begin).toHaveBeenCalledTimes(1);expect(host.move).toHaveBeenCalledTimes(1);
  });
  it('ignores right clicks, absent slots, and input away from the pieces',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736,{button:2});canvas.pointer('pointerdown',240,736);canvas.pointer('pointerdown',102,500);expect(host.begin).not.toHaveBeenCalled();
  });
});
