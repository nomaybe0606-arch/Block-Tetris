import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { NeonEffects } from '../src/rendering/NeonEffects';
import { getShape } from '../src/core/shapes';
import { ANIMATION } from '../src/config/animation';

function make(){
    const node={x:0,y:0,active:false,visible:false,tintTopLeft:0,scaleX:1,scaleY:1,
      setPosition(x:number,y:number){this.x=x;this.y=y;return this;},setActive(active:boolean){this.active=active;return this;},setVisible(visible:boolean){this.visible=visible;return this;},
      setTint(tint:number){this.tintTopLeft=tint;return this;},setDepth(){return this;},setBlendMode(){return this;},setDisplaySize(){return this;},setAlpha(){return this;},setScale(){return this;},destroy:vi.fn()};
    return node;
}
function setup(){
  const nodes:ReturnType<typeof make>[]=[];
  const scene={add:{image:vi.fn(()=>{const node=make();nodes.push(node);return node;})},tweens:{killTweensOf:vi.fn(),add:vi.fn()}};
  return {nodes,scene,effects:new NeonEffects(scene as unknown as Phaser.Scene)};
}
describe('bounded neon effects',()=>{
  it('reuses a fixed pool across long repeated sessions',()=>{
    const s=setup(),allocated=ANIMATION.particlePoolSize+ANIMATION.maxTrail+8+2;
    expect(s.nodes).toHaveLength(allocated);
    for(let i=0;i<300;i++){s.effects.emit(240,400,0xffaa00,80);s.effects.pulse(240,400,100,100,0xffffff);}
    expect(s.nodes).toHaveLength(allocated);expect(s.scene.add.image).toHaveBeenCalledTimes(allocated);
    expect(s.nodes.filter(node=>node.active).length).toBeLessThanOrEqual(allocated);
  });
  it('clears effects and tweens for Reduced Motion, reset and shutdown',()=>{
    const s=setup();s.effects.emit(0,0,0xffffff,8);s.effects.configure(true,true,60);
    expect(s.nodes.every(node=>!node.active&&!node.visible)).toBe(true);expect(s.effects.budget(32)).toBe(0);
    s.effects.configure(false,false,60);expect(s.effects.budget(32)).toBe(0);
    s.effects.configure(false,true,60);s.effects.emit(0,0,0xffffff,8);s.effects.reset();expect(s.nodes.every(node=>!node.active)).toBe(true);
    s.effects.destroy();for(const node of s.nodes)expect(node.destroy).toHaveBeenCalledTimes(1);
  });
  it('degrades decorative particles under sustained low FPS and recovers',()=>{
    const s=setup();for(let i=0;i<30;i++)s.effects.configure(false,true,30);expect(s.effects.budget(24)).toBe(12);
    for(let i=0;i<40;i++)s.effects.configure(false,true,60);expect(s.effects.budget(24)).toBe(24);
  });
  it('adds decorative following without modifying the exact drag pose',()=>{
    const s=setup(),start=Object.freeze({x:100,y:200,scale:1,column:1,row:2}),target=Object.freeze({...start,x:300,y:400,column:3,row:5});
    s.effects.begin(getShape('square-2'),1,start);s.effects.move(target);s.effects.update(16);
    expect(target).toEqual({x:300,y:400,scale:1,column:3,row:5});
    const halo=s.nodes.at(-2)!;expect(halo.x).toBeGreaterThan(start.x);expect(halo.x).toBeLessThan(target.x);
  });
});
