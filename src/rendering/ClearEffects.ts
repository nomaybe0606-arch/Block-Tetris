import type Phaser from 'phaser';
import { COLORS, GRID } from '../config/layout';
import { FEEDBACK } from '../config/feedback';
import type { ClearEvent } from './ClearEvent';
import { FeedbackLabel } from './FeedbackAtlas';
import { sprite, spriteTexture } from './SpriteAtlas';

interface Ghost {node:Phaser.GameObjects.Image;start:number;end:number;wave:number;reduced:boolean}
interface Beam {node:Phaser.GameObjects.Image;glint:Phaser.GameObjects.Image;start:number;end:number;x:number;y:number;horizontal:boolean;alpha:number}
interface Particle {node:Phaser.GameObjects.Image;start:number;end:number;x:number;y:number;vx:number;vy:number}
interface Pulse {node:Phaser.GameObjects.Image;start:number;end:number;width:number;height:number;alpha:number}
interface Sound {at:number;callback:(()=>void)|null}
const hide=(node:Phaser.GameObjects.Image)=>{node.setVisible(false).setActive(false);};

/** Fixed, frame-driven pools. This class has no reference to the logical board or TweenManager. */
export class ClearEffects {
  private time=0;private ghostCursor=0;private beamCursor=0;private particleCursor=0;private pulseCursor=0;private soundCursor=0;
  private running=false;
  private ghosts:Ghost[]=[];private beams:Beam[]=[];private particles:Particle[]=[];private pulses:Pulse[]=[];
  private sounds:Sound[]=Array.from({length:8},()=>({at:0,callback:null}));
  private callout:FeedbackLabel;private points:FeedbackLabel;
  constructor(scene:Phaser.Scene,private layer:Phaser.GameObjects.Container,private budget:(count:number)=>number){
    const make=(key:string)=>{const node=sprite(scene,0,0,key).setVisible(false).setActive(false);layer.add(node);return node;};
    for(let i=0;i<128;i++)this.ghosts.push({node:make('block-1').setDisplaySize(49,49),start:0,end:-1,wave:0,reduced:false});
    for(let i=0;i<32;i++)this.beams.push({node:make('line-glow').setBlendMode('ADD'),glint:make('neon-glow').setBlendMode('ADD'),start:0,end:-1,x:0,y:0,horizontal:true,alpha:0});
    for(let i=0;i<32;i++)this.particles.push({node:make('particle').setBlendMode('ADD'),start:0,end:-1,x:0,y:0,vx:0,vy:0});
    for(let i=0;i<8;i++)this.pulses.push({node:make('neon-glow').setBlendMode('ADD'),start:0,end:-1,width:0,height:0,alpha:0});
    this.callout=new FeedbackLabel(scene);this.points=new FeedbackLabel(scene);
  }
  clear(event:ClearEvent,reduced:boolean,onStart?:()=>void):void{
    this.running=true;
    const start=this.time+(reduced?0:FEEDBACK.clearLeadMs),duration=reduced?FEEDBACK.reducedClearMs:FEEDBACK.clearDurationMs;
    for(let i=0;i<event.cells.length;i++){
      const cell=event.cells[i],ghost=this.ghosts[this.ghostCursor++%this.ghosts.length];
      ghost.start=start;ghost.end=start+duration;ghost.wave=reduced?0:Math.min(65,i*5);ghost.reduced=reduced;
      spriteTexture(ghost.node,`block-${cell.color}`);ghost.node.setPosition(GRID.x+cell.x*52+26,GRID.y+cell.y*52+26).setDisplaySize(49,49).setAlpha(1).setVisible(true).setActive(true);
    }
    const multi=event.rows.length+event.columns.length>1,color=multi?0xd1c3ff:0xa4fff0;
    if(!reduced){
      for(const row of event.rows)this.line(GRID.x,GRID.y+row*52,true,start,color,multi);
      for(const column of event.columns)this.line(GRID.x+column*52,GRID.y,false,start,color,multi);
      const count=this.budget(Math.min(event.cells.length*2,multi?FEEDBACK.multiLineParticles:FEEDBACK.singleLineParticles));
      for(let i=0;i<count;i++){
        const cell=event.cells[Math.floor(i*event.cells.length/count)],particle=this.particles[this.particleCursor++%this.particles.length];
        particle.start=start;particle.end=start+240+Math.random()*80;particle.x=GRID.x+cell.x*52+26;particle.y=GRID.y+cell.y*52+26;particle.vx=(Math.random()-.5)*95;particle.vy=(Math.random()-.5)*95;
        particle.node.setPosition(particle.x,particle.y).setTint(color).setScale(.8).setAlpha(0).setVisible(true).setActive(true);
      }
      const accents=Math.min(this.budget(4),Math.ceil(event.cells.length/8));
      for(let i=0;i<accents;i++){const cell=event.cells[Math.floor(i*event.cells.length/accents)];this.pulse(GRID.x+cell.x*52+26,GRID.y+cell.y*52+26,160,160,parseInt(COLORS[cell.color-1].slice(1),16),.28,start);}
      if(multi)this.pulse(240,GRID.y+GRID.cell*GRID.size/2,480,480,event.combo>=3?0xf377de:0x9c93ff,.4,start);
    }
    const sound=this.sounds[this.soundCursor++%this.sounds.length];sound.at=start;
    // Also start the score callout on the event's visual start, without a scene timer.
    sound.callback=()=>{onStart?.();this.callout.show(`+${event.points}${event.combo>1?` · Combo ${Math.min(8,event.combo)}×`:''}`,240,GRID.y+170,Math.min(4,Math.max(event.rows.length+event.columns.length,event.combo>=4?3:event.combo>=2?2:1)),reduced);};
    if(reduced){const callback=sound.callback;sound.callback=null;callback();}
  }
  private line(x:number,y:number,horizontal:boolean,start:number,color:number,multi:boolean):void{
    const beam=this.beams[this.beamCursor++%this.beams.length];beam.x=x;beam.y=y;beam.horizontal=horizontal;beam.start=start;beam.end=start+FEEDBACK.clearDurationMs;beam.alpha=multi?.78:.55;
    beam.node.setPosition(x+(horizontal?208:26),y+(horizontal?26:208)).setDisplaySize(412,multi?32:24).setAngle(horizontal?0:90).setTint(color).setAlpha(0).setVisible(true).setActive(true);
    beam.glint.setPosition(x+26,y+26).setDisplaySize(64,14).setAngle(horizontal?0:90).setTint(color).setAlpha(0).setVisible(true).setActive(true);
  }
  private pulse(x:number,y:number,width:number,height:number,color:number,alpha:number,start:number):void{
    // Coalesce large waves; rapid clears must not stack several full-board additive layers.
    const pulse=width>=400?this.pulses[0]:this.pulses[1+this.pulseCursor++%(this.pulses.length-1)];
    if(width>=400&&pulse.end>this.time)start=this.time;
    Object.assign(pulse,{start,end:start+260,width,height,alpha});
    pulse.node.setPosition(x,y).setDisplaySize(width,height).setTint(color).setAlpha(0).setVisible(true).setActive(true);
  }
  showPoints(points:number,x:number,y:number,reduced:boolean):void{this.running=true;this.points.show(`+${points}`,x,y,0,reduced);}
  update(delta:number):void{
    if(!this.running)return;
    this.time+=Math.max(0,delta);
    let alive=false;
    for(const sound of this.sounds)if(sound.callback&&this.time>=sound.at){const callback=sound.callback;sound.callback=null;callback();}
    for(const ghost of this.ghosts){
      if(ghost.end<0)continue;if(this.time>=ghost.end){ghost.end=-1;hide(ghost.node);continue;}
      alive=true;
      const t=Math.max(0,(this.time-ghost.start-ghost.wave)/(ghost.end-ghost.start-ghost.wave));ghost.node.setAlpha(1-t*t);
      if(!ghost.reduced)ghost.node.setScale(49/128*(1-.45*t));
    }
    for(const beam of this.beams){
      if(beam.end<0)continue;if(this.time>=beam.end){beam.end=-1;hide(beam.node);hide(beam.glint);continue;}
      alive=true;
      const t=Math.max(0,(this.time-beam.start)/(beam.end-beam.start)),sweep=Math.min(1,Math.max(0,(this.time-beam.start)/FEEDBACK.sweepDurationMs));
      beam.node.setAlpha(this.time<beam.start?0:beam.alpha*(1-t));beam.glint.setPosition(beam.x+26+(beam.horizontal?364*sweep:0),beam.y+26+(beam.horizontal?0:364*sweep)).setAlpha(this.time<beam.start?0:.95*(1-sweep));
    }
    for(const particle of this.particles){
      if(particle.end<0)continue;if(this.time>=particle.end){particle.end=-1;hide(particle.node);continue;}
      alive=true;
      const t=Math.max(0,(this.time-particle.start)/(particle.end-particle.start));particle.node.setPosition(particle.x+particle.vx*t,particle.y+particle.vy*t).setAlpha(this.time<particle.start?0:.85*(1-t)**2).setScale(.8*(1-t));
    }
    for(const pulse of this.pulses){
      if(pulse.end<0)continue;if(this.time>=pulse.end){pulse.end=-1;hide(pulse.node);continue;}
      alive=true;
      const t=Math.max(0,(this.time-pulse.start)/(pulse.end-pulse.start));pulse.node.setDisplaySize(pulse.width*(1+.12*t),pulse.height*(1+.12*t)).setAlpha(this.time<pulse.start?0:pulse.alpha*(1-t));
    }
    this.callout.update(delta);this.points.update(delta);
    this.running=alive||this.callout.playing||this.points.playing;
  }
  reset():void{
    this.running=false;
    for(const ghost of this.ghosts){ghost.end=-1;hide(ghost.node);}for(const beam of this.beams){beam.end=-1;hide(beam.node);hide(beam.glint);}
    for(const particle of this.particles){particle.end=-1;hide(particle.node);}for(const pulse of this.pulses){pulse.end=-1;hide(pulse.node);}
    for(const sound of this.sounds)sound.callback=null;this.callout.reset();this.points.reset();
  }
  get active():number{let count=this.callout.active+this.points.active;for(const node of this.layer.list)if(node.active&&(node as Phaser.GameObjects.Image).visible)count++;return count;}
}
