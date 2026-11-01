import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { Feedback } from '../src/rendering/Feedback';
import { FEEDBACK } from '../src/config/feedback';
import { newGame } from '../src/core/game';
import type { Placement } from '../src/core/types';

function sceneFake(){
  const nodes:{kind:string;destroyed:boolean}[]=[],tweens:Record<string,unknown>[]=[];
  const node=(kind:string)=>{
    const value={kind,destroyed:false,x:0,y:0,scaleX:1,scaleY:1,
      setDepth:()=>value,setDisplaySize:()=>value,setTint:()=>value,setScale:()=>value,setOrigin:()=>value,
      clear:()=>value,setAlpha:()=>value,setVisible:()=>value,setActive:()=>value,fillStyle:()=>value,fillRoundedRect:()=>value,destroy:()=>{value.destroyed=true;}};
    nodes.push(value);return value;
  };
  const scene={add:{graphics:()=>node('graphics'),image:()=>node('image'),rectangle:()=>node('rectangle'),text:()=>node('text')},tweens:{add:(config:Record<string,unknown>)=>tweens.push(config),killTweensOf:vi.fn()}};
  return {scene:scene as unknown as Phaser.Scene,nodes,tweens};
}
function result(rows:number[]):Placement{
  return {state:newGame(1),rows,columns:[],placed:[],cleared:rows.flatMap(y=>Array.from({length:8},(_,x)=>[x,y] as const)),points:10*rows.length**2};
}
describe('repeatable, bounded clearing feedback',()=>{
  it('adds a short line sweep and caps particles for one line',()=>{
    const fake=sceneFake();new Feedback(fake.scene).clear(result([3]),false);
    expect(fake.nodes.filter(n=>n.kind==='rectangle')).toHaveLength(1);
    expect(fake.nodes.filter(n=>n.kind==='image')).toHaveLength(FEEDBACK.singleLineParticles);
    expect(fake.tweens.some(t=>t.duration===FEEDBACK.sweepDurationMs)).toBe(true);
  });
  it('makes multiple lines stronger without exceeding a fixed particle budget',()=>{
    const fake=sceneFake();new Feedback(fake.scene).clear(result([0,1,2,3,4,5,6,7]),false);
    expect(fake.nodes.filter(n=>n.kind==='image')).toHaveLength(FEEDBACK.multiLineParticles);
    expect(fake.nodes.filter(n=>n.kind==='rectangle')).toHaveLength(8);
  });
  it('omits particles, sweeps and text travel under Reduced Motion',()=>{
    const fake=sceneFake();new Feedback(fake.scene).clear(result([3,4]),true);
    expect(fake.nodes.filter(n=>n.kind==='image'||n.kind==='rectangle')).toHaveLength(0);
    expect(fake.tweens[0].duration).toBe(FEEDBACK.reducedClearMs);
    expect(fake.tweens.at(-1)?.y).toBe(400);
  });
  it('replaces the previous callout instead of stacking repeated clear messages',()=>{
    const fake=sceneFake(),feedback=new Feedback(fake.scene);feedback.clear(result([3]),false);
    const first=fake.nodes.find(n=>n.kind==='text')!;feedback.clear(result([4]),false);
    expect(first.destroyed).toBe(true);expect(fake.nodes.filter(n=>n.kind==='text'&&!n.destroyed)).toHaveLength(1);
  });
});
