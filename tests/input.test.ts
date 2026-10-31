import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DragController } from '../src/input/DragController';
import { getShape } from '../src/core/shapes';

class FakeCanvas extends EventTarget {
  captured=new Set<number>();
  setPointerCapture(id:number){this.captured.add(id);}
  hasPointerCapture(id:number){return this.captured.has(id);}
  releasePointerCapture(id:number){this.captured.delete(id);}
  getBoundingClientRect(){return {left:100,top:50,width:240,height:425};}
  pointer(type:string,x:number,y:number,extra:Record<string,unknown>={}){
    const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:1,button:0,pointerType:'mouse',clientX:100+x/2,clientY:50+y/2,...extra});this.dispatchEvent(event);
  }
}
beforeEach(()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',Object.assign(new EventTarget(),{hidden:false}));});
function setup(){
  const canvas=new FakeCanvas(),host={enabled:vi.fn(()=>true),getPiece:vi.fn((slot:number)=>slot===0?{piece:{shapeId:'line-3-h',color:2},shape:getShape('line-3-h')}:null),begin:vi.fn(),move:vi.fn(),end:vi.fn(),cancel:vi.fn()};
  const controller=new DragController(canvas as unknown as HTMLCanvasElement,host);return {canvas,host,controller};
}
describe('pointer lifecycle and scaled coordinates',()=>{
  it('maps CSS-scaled client coordinates and commits once on release',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);canvas.pointer('pointermove',370,568);canvas.pointer('pointerup',370,568);canvas.pointer('lostpointercapture',370,568);
    expect(host.begin).toHaveBeenCalledTimes(1);expect(host.move).toHaveBeenLastCalledWith(370,568,5,6);expect(host.end).toHaveBeenCalledExactlyOnceWith(5,6);expect(host.cancel).not.toHaveBeenCalled();expect(canvas.captured.size).toBe(0);
  });
  it('applies touch lift at the final release, not only while moving',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736,{pointerType:'touch'});canvas.pointer('pointerup',370,656,{pointerType:'touch'});expect(host.end).toHaveBeenCalledExactlyOnceWith(5,6);
  });
  it('cancels and releases capture on pointercancel without placing',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);canvas.pointer('pointercancel',370,568);canvas.pointer('pointerup',370,568);expect(host.cancel).toHaveBeenCalledTimes(1);expect(host.end).not.toHaveBeenCalled();expect(canvas.captured.size).toBe(0);
  });
  it('cancels a lost capture or window blur, and permits the next gesture',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);canvas.pointer('lostpointercapture',0,0);canvas.pointer('pointerdown',102,736);window.dispatchEvent(new Event('blur'));
    expect(host.cancel).toHaveBeenCalledTimes(2);expect(host.begin).toHaveBeenCalledTimes(2);expect(host.end).not.toHaveBeenCalled();
  });
  it('ignores a second finger and its release',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);canvas.pointer('pointerdown',240,736,{pointerId:2});canvas.pointer('pointerup',370,568,{pointerId:2});expect(host.end).not.toHaveBeenCalled();canvas.pointer('pointerup',370,568);expect(host.end).toHaveBeenCalledTimes(1);expect(host.begin).toHaveBeenCalledTimes(1);
  });
  it('cancels instead of committing if the host becomes disabled',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);host.enabled.mockReturnValue(false);canvas.pointer('pointerup',370,568);expect(host.cancel).toHaveBeenCalledTimes(1);expect(host.end).not.toHaveBeenCalled();
  });
  it('cancels a gesture when the tab becomes hidden',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736);Object.assign(document,{hidden:true});document.dispatchEvent(new Event('visibilitychange'));expect(host.cancel).toHaveBeenCalledTimes(1);expect(canvas.captured.size).toBe(0);
  });
  it('ignores right clicks, missing slots and non-tray input',()=>{
    const {canvas,host}=setup();canvas.pointer('pointerdown',102,736,{button:2});canvas.pointer('pointerdown',240,736);canvas.pointer('pointerdown',102,500);expect(host.begin).not.toHaveBeenCalled();
  });
  it('removes listeners and cancels active input on destroy',()=>{
    const {canvas,host,controller}=setup();expect(controller.dragging).toBe(false);canvas.pointer('pointerdown',102,736);expect(controller.dragging).toBe(true);controller.destroy();expect(controller.dragging).toBe(false);canvas.pointer('pointerup',370,568);canvas.pointer('pointerdown',102,736);expect(host.cancel).toHaveBeenCalledTimes(1);expect(host.begin).toHaveBeenCalledTimes(1);expect(host.end).not.toHaveBeenCalled();
  });
});
