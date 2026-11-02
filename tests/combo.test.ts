import {describe,expect,it} from 'vitest';
import {ComboBurst,comboStyle} from '../src/rendering/ComboBurst';
import {ClearEffects} from '../src/rendering/ClearEffects';
import {renderScene} from './helpers/renderScene';
describe('progressively stronger combo celebration',()=>{
  it('respects the adaptive spark budget while retaining the main x8 label and glow',()=>{
    const s=renderScene(),burst=new ComboBurst(s.scene);burst.show(8,240,347,false,'en',1);expect(burst.active).toBe(4);burst.update(160);expect(s.nodes.find(node=>node.key==='combo-labels')!.scaleX).toBeGreaterThan(1);
  });
  it('grows on each multiplier through x8 and caps presentation at the real multiplier cap',()=>{
    let scale=0,glow=0;for(let level=2;level<=8;level++){const style=comboStyle(level);expect(style.scale).toBeGreaterThan(scale);expect(style.glow).toBeGreaterThan(glow);scale=style.scale;glow=style.glow;}
    expect(comboStyle(99)).toEqual(comboStyle(8));
  });
  it.each(['en','ru'] as const)('uses a baked %s label rather than updating Canvas Text',language=>{
    const s=renderScene(),burst=new ComboBurst(s.scene);burst.show(7,240,347,false,language);
    expect(s.nodes.find(node=>node.key==='combo-labels')!.frame).toBe(`${language}-7`);expect(s.raw.add.text).not.toHaveBeenCalled();
  });
  it('makes x8 larger, brighter and richer in sparks with a modestly longer animation',()=>{
    const s=renderScene(),burst=new ComboBurst(s.scene),label=s.nodes.find(node=>node.key==='combo-labels')!,glow=s.nodes.find(node=>node.key==='neon-glow')!;
    burst.show(2,240,347,false,'en');const smallGlow=glow.alpha,smallCount=burst.active;burst.update(160);const small=label.scaleX;burst.update(comboStyle(2).duration-160);expect(burst.playing).toBe(false);
    burst.show(8,240,347,false,'en');expect(glow.alpha).toBeGreaterThan(smallGlow);expect(burst.active).toBeGreaterThan(smallCount);burst.update(160);expect(label.scaleX).toBeGreaterThan(small);burst.update(comboStyle(2).duration-160);expect(burst.playing).toBe(true);burst.update(comboStyle(8).duration-comboStyle(2).duration);expect(burst.playing).toBe(false);
  });
  it('extends each multiplier from 520 to 700ms without slowing the initial pop',()=>{
    const s=renderScene(),burst=new ComboBurst(s.scene),label=s.nodes.find(node=>node.key==='combo-labels')!;
    let previous=0;
    for(let level=2;level<=8;level++){
      const style=comboStyle(level);expect(style.duration).toBeGreaterThan(previous);expect(style.duration).toBeLessThanOrEqual(700);previous=style.duration;
      burst.show(level,240,347,false,'en');burst.update(150);expect(label.scaleX).toBeCloseTo(style.scale);burst.update(style.duration-151);expect(burst.playing).toBe(true);burst.update(1);expect(burst.playing).toBe(false);
    }
    expect(comboStyle(2).duration).toBe(520);expect(comboStyle(8).duration).toBe(700);
  });
  it('reuses the same nine images for 1000 consecutive combo bursts without tweens',()=>{
    const s=renderScene(),burst=new ComboBurst(s.scene),allocated=s.nodes.length;
    for(let i=0;i<1000;i++){burst.show(2+i%7,240,347,false,'ru');burst.update(32);expect(burst.active).toBeLessThanOrEqual(9);}
    expect(s.nodes).toHaveLength(allocated);expect(s.tweens).toHaveLength(0);burst.update(1000);expect(burst.active).toBe(0);
  });
  it('keeps reduced motion stationary and suppresses glow, rings and sparks',()=>{
    const s=renderScene(),burst=new ComboBurst(s.scene),label=s.nodes.find(node=>node.key==='combo-labels')!;
    burst.show(8,240,347,false,'ru');burst.update(100);burst.show(8,240,347,true,'ru');const scale=label.scaleX;burst.update(75);
    expect(burst.active).toBe(1);expect(label.y).toBe(0);expect(label.scaleX).toBe(scale);expect(burst.root.x).toBe(240);expect(burst.root.y).toBe(347);burst.update(75);expect(burst.active).toBe(0);
  });
  it('replaces an unfinished burst immediately and reset removes it',()=>{
    const s=renderScene(),burst=new ComboBurst(s.scene);burst.show(2,240,347,false,'en');burst.update(300);burst.show(7,240,347,false,'ru');burst.update(160);
    expect(burst.playing).toBe(true);expect(s.nodes.find(node=>node.key==='combo-labels')!.frame).toBe('ru-7');burst.reset();expect(burst.active).toBe(0);burst.update(1000);expect(burst.root.visible).toBe(false);
  });
  it('starts on the clear event and never writes to its snapshot or model',()=>{
    const s=renderScene(),layer=s.scene.add.container(),effects=new ClearEffects(s.scene,layer,count=>count,()=> 'ru');
    const event={gameId:'test',move:7,points:71,combo:7,rows:[0],columns:[],cells:Array.from({length:8},(_,x)=>({x,y:0,color:1}))},before=JSON.stringify(event);
    effects.clear(event,false);effects.update(16);expect(s.nodes.find(node=>node.key==='combo-labels')!.parent!.visible).toBe(false);effects.update(30);
    expect(s.nodes.find(node=>node.key==='combo-labels')!.frame).toBe('ru-7');effects.update(1000);expect(effects.active).toBe(0);expect(JSON.stringify(event)).toBe(before);expect(s.tweens).toHaveLength(0);
  });
});
