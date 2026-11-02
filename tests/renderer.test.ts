import { describe, expect, it, vi } from 'vitest';
import { BoardRenderer } from '../src/rendering/BoardRenderer';
import { NeonEffects } from '../src/rendering/NeonEffects';
import { Feedback } from '../src/rendering/Feedback';
import { newGame } from '../src/core/game';
import { emptyBoard } from '../src/core/board';
import { getShape } from '../src/core/shapes';
import { renderScene, RenderNode } from './helpers/renderScene';
import { GRID } from '../src/config/layout';

describe('persistent rendering during play',()=>{
  it('draws only the board frame and leaves the entire pickup strip free of slot backplates',()=>{
    const s=renderScene(),draw=vi.spyOn(RenderNode.prototype,'fillRoundedRect');
    try{new BoardRenderer(s.scene);expect(draw).toHaveBeenCalledTimes(2);expect((draw.mock.calls as unknown[][]).every(args=>Number(args[1])<GRID.y)).toBe(true);}finally{draw.mockRestore();}
  });
  it('allows grabbing a newly dealt piece before its fade-in has advanced',()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),state=newGame(4);board.renderTray(state,false,true);
    expect(board.trayTransform(0)).toMatchObject({scale:expect.any(Number)});
    expect(board.trayTransform(0)!.scale).toBeGreaterThan(0);
  });
  it('reuses all board cells through 1000 board updates and resets cleared cells',()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),count=s.nodes.length,state=emptyBoard();
    for(let move=0;move<1000;move++){const x=move%8,y=Math.floor(move/8)%8;state[y][x]=move%8;board.render(state);}
    expect(s.nodes).toHaveLength(count);expect(s.nodes.filter(node=>node.kind==='image'&&node.destroyed)).toHaveLength(0);
    state[0][0]=2;board.render(state);const block=s.nodes.find(node=>node.key==='block-2'&&node.x===58&&node.y===GRID.y+26)!;
    board.clearCells([[0,0]],false);s.complete();expect(block.alpha).toBe(0);
    state[0][0]=0;board.render(state);state[0][0]=2;board.render(state);
    expect(block.visible).toBe(true);expect(block.alpha).toBe(1);expect(block.scaleX).toBe(49/128);
  });
  it('keeps unchanged tray containers and their actual appearance transforms',()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),state=newGame(4);board.renderTray(state,false,true);s.complete();
    const containers=s.nodes.filter(node=>node.kind==='container'),before=board.trayTransform(1)!;
    board.renderTray({...state,tray:[null,state.tray[1],state.tray[2]]},false);
    expect(board.trayTransform(1)).toEqual(before);expect(containers.filter(node=>!node.destroyed)).toHaveLength(containers.length-1);
    expect(s.nodes.filter(node=>node.kind==='container')).toHaveLength(containers.length);
  });
  it('reuses both preview graphics and all drag images over repeated gestures',()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),count=s.nodes.length,state=emptyBoard();
    for(let i=0;i<600;i++){
      const shape=getShape(i%2?'square-3':'line-2-h');const node=board.acquireDrag({shapeId:shape.id,color:2},shape);
      expect(node.visible).toBe(true);board.showPreview(state,shape,i%7,Math.floor(i/7)%7);board.releaseDrag();
    }
    board.clearPreview();expect(s.nodes).toHaveLength(count);expect(s.active.size).toBe(0);
    expect(s.nodes.filter(node=>node.kind==='image'&&node.destroyed)).toHaveLength(0);
  });
  it('preserves land animation on unchanged cells and omits it with Reduced Motion',()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),state=emptyBoard();state[0][0]=1;board.render(state);
    board.landCells([[0,0]],false);const active=s.active.size;board.render(state);expect(s.active.size).toBe(active);
    s.complete();expect([...s.nodes].find(node=>node.key==='block-1'&&node.x===58&&node.y===GRID.y+26)?.scaleY).toBe(49/128);
    board.landCells([[0,0]],true);expect(s.active.size).toBe(0);
  });
  it('retains a proportional particle budget for one-at-a-time emissions at low FPS',()=>{
    const s=renderScene(),neon=new NeonEffects(s.scene);for(let i=0;i<30;i++)neon.configure(false,true,30);
    for(let i=0;i<14;i++)neon.emit(200,300,0xffffff,1);
    expect(s.nodes.filter(node=>node.key==='particle'&&node.active)).toHaveLength(7);
    neon.configure(true,true,30);neon.emit(0,0,0xffffff,1);expect(s.nodes.every(node=>!node.active)).toBe(true);
  });
  it('reuses callout and points text across repeated successful moves',()=>{
    const s=renderScene(),neon=new NeonEffects(s.scene),feedback=new Feedback(s.scene,neon);
    const state=newGame(1),result={state,rows:[3],columns:[],placed:[],cleared:Array.from({length:8},(_,x)=>[x,3] as const),points:10};
    const allocated=s.nodes.length;
    for(let i=0;i<100;i++){feedback.clear(result,false);feedback.points(i,100,200,false);feedback.update(500);s.complete();}
    expect(s.nodes).toHaveLength(allocated);
    expect(s.raw.add.text).not.toHaveBeenCalled();expect(s.nodes.filter(node=>node.kind==='text'&&node.destroyed)).toHaveLength(0);expect(feedback.active).toBe(0);
    feedback.reset();expect(s.nodes.filter(node=>node.kind==='text').every(node=>!node.active&&!node.visible)).toBe(true);
  });
  it('does not snap remaining tray figures to full size during a rapid next move',()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),state=newGame(4);board.renderTray(state,false,true);
    const remaining=s.nodes.filter(node=>node.kind==='container').at(-2)!;remaining.setAlpha(.5).setScale(.48).setY(740);
    const before=board.trayTransform(1);board.renderTray({...state,tray:[null,state.tray[1],state.tray[2]]},false);
    expect(board.trayTransform(1)).toEqual(before);expect(remaining.alpha).toBe(.5);
  });
});
