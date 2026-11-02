import {describe,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {createSpriteAtlas,sprite,spriteTexture} from '../src/rendering/SpriteAtlas';
import {BoardRenderer} from '../src/rendering/BoardRenderer';
import {renderScene,RenderNode} from './helpers/renderScene';
import {emptyBoard} from '../src/core/board';
import {getShape} from '../src/core/shapes';
describe('shared textures and allocation-free preview',()=>{
  it('packs all frames without overlap in a single mobile-safe texture and releases old sources',()=>{
    const frames:{key:string;x:number;y:number;w:number;h:number}[]=[],remove=vi.fn(),refresh=vi.fn();
    const atlas={context:{drawImage:vi.fn()},add:(key:string,_source:number,x:number,y:number,w:number,h:number)=>frames.push({key,x,y,w,h}),refresh};
    const scene={textures:{createCanvas:vi.fn(()=>atlas),get:()=>({getSourceImage:()=>({})}),remove}} as unknown as Phaser.Scene;
    createSpriteAtlas(scene);expect(scene.textures.createCanvas).toHaveBeenCalledWith('neon-atlas',1024,1024);expect(frames).toHaveLength(13);expect(remove).toHaveBeenCalledTimes(13);expect(refresh).toHaveBeenCalledTimes(1);
    for(const a of frames){expect(a.x+a.w).toBeLessThanOrEqual(1024);expect(a.y+a.h).toBeLessThanOrEqual(1024);for(const b of frames)if(a!==b)expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true);}
  });
  it('uses the same GPU texture when a cell changes color',()=>{
    const node={texture:{key:'neon-atlas'},setTexture:vi.fn()},scene={textures:{exists:()=>true},add:{image:vi.fn(()=>node)}} as unknown as Phaser.Scene;
    sprite(scene,10,20,'block-1');expect(scene.add.image).toHaveBeenCalledWith(10,20,'neon-atlas','block-1');spriteTexture(node as unknown as Phaser.GameObjects.Image,'block-7');expect(node.setTexture).toHaveBeenCalledWith('neon-atlas','block-7');
  });
  it('moves preview 1000 times without vector tessellation, new objects or mutation of the model',()=>{
    const s=renderScene(),renderer=new BoardRenderer(s.scene),board=emptyBoard(),allocated=s.nodes.length,draw=vi.spyOn(RenderNode.prototype,'fillRoundedRect');
    try{for(let i=0;i<1000;i++)renderer.showPreview(board,getShape('square-3'),i%6,Math.floor(i/6)%6);expect(draw).not.toHaveBeenCalled();expect(s.nodes).toHaveLength(allocated);expect(board.flat().every(value=>value===0)).toBe(true);}finally{draw.mockRestore();}
  });
  it('predicts a completed line and removes its highlight as soon as the candidate changes',()=>{
    const s=renderScene(),renderer=new BoardRenderer(s.scene),board=emptyBoard();board[0]=[1,1,1,1,1,1,1,0];const shape=getShape('single');
    expect(renderer.showPreview(board,shape,7,0)).toBe(true);expect(renderer['lineCells'].filter(cell=>cell.visible)).toHaveLength(8);
    renderer.showPreview(board,shape,7,1);expect(renderer['lineCells'].some(cell=>cell.visible)).toBe(false);renderer.clearPreview();expect(renderer['previewCells'].some(cell=>cell.visible)).toBe(false);
  });
});
