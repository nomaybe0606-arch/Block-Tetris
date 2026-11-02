import { describe, expect, it } from 'vitest';
import { SHAPES, getShape } from '../src/core/shapes';
import { newGame } from '../src/core/game';
import { emptyBoard } from '../src/core/board';
import { GRID, TRAY } from '../src/config/layout';
import { TRAY_AREA, trayTransformFor } from '../src/rendering/trayLayout';
import { bufferRatio } from '../src/rendering/renderConfig';
import { BoardRenderer } from '../src/rendering/BoardRenderer';
import { SwapAnimation } from '../src/rendering/SwapAnimation';
import { NeonEffects } from '../src/rendering/NeonEffects';
import { renderScene } from './helpers/renderScene';

describe('mobile tray and release continuity',()=>{
  it('fits a tall rewarded replacement throughout its appearance without changing the logical tray',async()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),state=newGame(1),from={shapeId:'single',color:2},to={shapeId:'line-5-v',color:3};
    state.tray=[from,null,null];board.renderTray(state,false,false,true);const snapshot=JSON.stringify(state);
    const swap=new SwapAnimation(s.scene,board,new NeonEffects(s.scene)),done=swap.play({key:'fit',slot:0,from,to,position:[0,0]},false);
    const target=s.tweens.find(tween=>tween.alpha===1&&tween.delay===160)!;
    expect(target.scale).toBe(board.trayTarget(getShape(to.shapeId),0).scale);s.complete();await done;
    expect(JSON.stringify(state)).toBe(snapshot);
  });
  it.each([false,true])('fits every shape inside its slot and below its label (rewarded=%s)',reserved=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),state=newGame(1);
    for(const shape of SHAPES){
      state.tray=TRAY.centers.map(()=>({shapeId:shape.id,color:2}));board.renderTray(state,false,true,reserved);
      for(let slot=0;slot<3;slot++){
        const home=trayTransformFor(shape,slot,reserved),shown=board.trayTransform(slot)!;
        for(const pose of [shown,home]){
          expect(pose.x-shape.width*GRID.cell*pose.scale/2).toBeGreaterThan(TRAY.centers[slot]-TRAY_AREA.width/2);
          expect(pose.x+shape.width*GRID.cell*pose.scale/2).toBeLessThan(TRAY.centers[slot]+TRAY_AREA.width/2);
          expect(pose.y-shape.height*GRID.cell*pose.scale/2).toBeGreaterThan(TRAY_AREA.top);
          expect(pose.y+shape.height*GRID.cell*pose.scale/2).toBeLessThan(TRAY_AREA.bottom);
        }
        expect(board.trayHome(slot)).toEqual(home);
      }
      s.complete();
    }
  });
  it('starts landing at the exact last dragged position and settles without waiting for input',()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),state=emptyBoard();state[1][2]=3;board.render(state);
    const from={x:170,y:300,scale:.6,column:2,row:1};board.landCells([[2,1]],false,from,getShape('single'));
    const block=s.nodes.find(node=>node.key==='block-3'&&node.visible)!;
    expect(block.x).toBe(from.x);expect(block.y).toBe(from.y);expect(block.scaleX).toBeCloseTo(49/128*.6);
    s.complete();expect(block.x).toBe(GRID.x+2*52+26);expect(block.y).toBe(GRID.y+52+26);expect(block.scaleX).toBeCloseTo(49/128);
  });
  it('cancels a landing safely when its cell clears and the same coordinate is reused',()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene),state=emptyBoard();state[1][2]=3;board.render(state);
    board.landCells([[2,1]],false,{x:170,y:300,scale:.6,column:2,row:1},getShape('single'));
    state[1][2]=0;board.render(state);state[1][2]=4;board.render(state);s.complete();
    const cell=s.nodes.find(node=>node.key==='block-4'&&node.visible)!;
    expect(cell.x).toBe(GRID.x+2*52+26);expect(cell.y).toBe(GRID.y+52+26);expect(cell.alpha).toBe(1);
  });
});

describe('mobile renderer budget',()=>{
  it('batches all board reflections before the cells instead of changing blend mode 32 times',()=>{
    const s=renderScene(),board=new BoardRenderer(s.scene);board.render(Array.from({length:8},()=>Array(8).fill(2)));
    const reflections=s.nodes.filter(node=>node.key==='neon-glow'&&node.visible&&(node.parent?.parent as unknown)===board.root);
    const blocks=s.nodes.filter(node=>node.key==='block-2'&&node.visible);
    expect(reflections).toHaveLength(16);expect(blocks).toHaveLength(64);
    expect(new Set(reflections.map(node=>node.parent)).size).toBe(1);expect(reflections[0].parent).not.toBe(blocks[0].parent);
    const order=board.root.list as unknown[];expect(order.indexOf(reflections[0].parent)).toBeLessThan(order.indexOf(blocks[0].parent));
    const changes=(modes:string[])=>modes.reduce((value,mode,i)=>value+(mode!==(modes[i-1]??'NORMAL')?1:0),0);
    const old=blocks.flatMap((node,i)=>i%4===0?['ADD',node.blendMode]:[node.blendMode]);
    const current=[...reflections,...blocks].map(node=>node.blendMode);
    expect(changes(old)).toBe(32);expect(changes(current)).toBe(2);
  });
  it('allocates two buffer pixels per displayed CSS pixel rather than per unscaled scene unit',()=>{
    const ratio=bufferRatio(390/480,3);expect(ratio).toBe(1.625);expect(480*ratio).toBe(780);
    expect((ratio/2)**2).toBeLessThan(.67);expect(bufferRatio(1.5,3)).toBe(2);expect(bufferRatio(.75,1)).toBe(.75);
  });
});
