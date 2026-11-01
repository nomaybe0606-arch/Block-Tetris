import type Phaser from 'phaser';
import { ANIMATION } from '../config/animation';
import { COLORS, GRID } from '../config/layout';
import type { Board, Placement, Shape } from '../core/types';
import type { DragPose } from '../input/dragGeometry';

/** Fixed pools: decorative lag never changes the drag pose or placement candidate. */
export class NeonEffects {
  private particles:Phaser.GameObjects.Image[]=[];
  private trails:Phaser.GameObjects.Image[]=[];
  private pulses:Phaser.GameObjects.Image[]=[];
  private halo:Phaser.GameObjects.Image;
  private shadow:Phaser.GameObjects.Image;
  private cursor=0;private trailCursor=0;private pulseCursor=0;private lastTrail=0;
  private target={x:0,y:0};private dragging=false;private enabled=true;private quality=1;private slowFrames=0;
  private particleCredit=0;
  constructor(private scene:Phaser.Scene){
    const make=(key:string,depth:number)=>scene.add.image(0,0,key).setDepth(depth).setVisible(false).setActive(false);
    this.particles=Array.from({length:ANIMATION.particlePoolSize},()=>make('particle',16));
    this.trails=Array.from({length:ANIMATION.maxTrail},()=>make('neon-glow',24).setBlendMode('ADD'));
    this.pulses=Array.from({length:8},()=>make('neon-glow',14).setBlendMode('ADD'));
    this.halo=make('neon-glow',26).setBlendMode('ADD');this.shadow=make('neon-glow',25).setTint(0x000000);
  }
  configure(reduced:boolean,intense:boolean,fps:number):void{
    const enabled=!reduced&&intense;
    if(!enabled&&this.enabled)for(const node of this.nodes()){this.scene.tweens.killTweensOf(node);node.setVisible(false).setActive(false);}
    this.enabled=enabled;
    this.slowFrames=fps>0&&fps<ANIMATION.lowFpsThreshold?Math.min(60,this.slowFrames+1):Math.max(0,this.slowFrames-1);
    this.quality=this.slowFrames>20?.5:1;
  }
  begin(shape:Shape,color:number,pose:DragPose):void{
    this.dragging=true;this.target.x=pose.x;this.target.y=pose.y;
    if(!this.enabled)return;
    for(const node of [this.halo,this.shadow]){this.scene.tweens.killTweensOf(node);node.setPosition(pose.x,pose.y).setActive(true).setVisible(true);}
    this.halo.setTint(this.color(color)).setDisplaySize(shape.width*52+80,shape.height*52+70).setAlpha(.12);
    this.scene.tweens.add({targets:this.halo,alpha:.4,duration:100,ease:'Sine.Out'});
    this.shadow.setDisplaySize(shape.width*52+45,shape.height*52+38).setAlpha(.7);
  }
  move(pose:DragPose):void{
    const distance=Math.hypot(this.target.x-pose.x,this.target.y-pose.y);this.target.x=pose.x;this.target.y=pose.y;
    if(!this.enabled||distance<12||this.quality<1||performance.now()-this.lastTrail<ANIMATION.trailIntervalMs)return;
    this.lastTrail=performance.now();const node=this.trails[this.trailCursor++%this.trails.length];
    this.scene.tweens.killTweensOf(node);node.setActive(true).setVisible(true).setPosition(pose.x,pose.y).setDisplaySize(90,90).setTint(this.halo.tintTopLeft).setAlpha(.13);
    this.scene.tweens.add({targets:node,alpha:0,duration:130,onComplete:()=>node.setActive(false).setVisible(false)});
  }
  update(delta:number):void{
    if(!this.dragging||!this.enabled)return;
    const f=1-Math.exp(-delta/ANIMATION.haloFollowMs);
    this.halo.x+=(this.target.x-this.halo.x)*f;this.halo.y+=(this.target.y-this.halo.y)*f;
    this.shadow.x+=(this.target.x+5-this.shadow.x)*f;this.shadow.y+=(this.target.y+12-this.shadow.y)*f;
  }
  end():void{
    this.dragging=false;
    for(const node of [this.halo,this.shadow]){this.scene.tweens.killTweensOf(node);this.scene.tweens.add({targets:node,alpha:0,duration:120,onComplete:()=>node.setVisible(false).setActive(false)});}
  }
  color(index:number):number{return parseInt((COLORS[index-1]??COLORS[0]).slice(1),16);}
  budget(requested:number):number{return this.enabled?Math.min(this.particles.length,Math.floor(requested*this.quality)):0;}
  emit(x:number,y:number,color:number,count:number):void{
    const credit=this.enabled?Math.max(0,count)*this.quality+this.particleCredit:0;
    const allocated=Math.min(this.particles.length,Math.floor(credit));this.particleCredit=credit%1;
    for(let i=0;i<allocated;i++){
      const node=this.particles[this.cursor++%this.particles.length];this.scene.tweens.killTweensOf(node);
      node.setActive(true).setVisible(true).setPosition(x,y).setTint(color).setAlpha(.85).setScale(.5+Math.random()*.6);
      this.scene.tweens.add({targets:node,x:x+(Math.random()-.5)*95,y:y+(Math.random()-.5)*95,scale:0,alpha:0,duration:220+Math.random()*100,onComplete:()=>node.setActive(false).setVisible(false)});
    }
  }
  pulse(x:number,y:number,width:number,height:number,color:number,alpha=.3):void{
    if(!this.enabled)return;
    const node=this.pulses[this.pulseCursor++%this.pulses.length];this.scene.tweens.killTweensOf(node);
    node.setPosition(x,y).setDisplaySize(width,height).setTint(color).setVisible(true).setActive(true).setAlpha(alpha);
    this.scene.tweens.add({targets:node,scaleX:node.scaleX*1.12,scaleY:node.scaleY*1.12,alpha:0,duration:260,onComplete:()=>node.setActive(false).setVisible(false)});
  }
  placement(result:Placement,color:number):void{
    for(const [x,y] of result.placed.filter((_,i)=>i%2===0).slice(0,4))this.pulse(GRID.x+x*52+26,GRID.y+y*52+26,112,112,this.color(color),.23);
  }
  clearAccent(result:Placement,board:Board):void{
    for(const [x,y] of result.cleared.filter((_,i)=>i%8===0).slice(0,6))this.pulse(GRID.x+x*52+26,GRID.y+y*52+26,160,160,this.color(board[y][x]),.25);
    if(result.rows.length+result.columns.length>=2)this.pulse(240,438,480,480,result.state.combo>=3?0xf377de:0x9c93ff,.4);
  }
  assemble(from:{x:number;y:number}[],to:{x:number;y:number}[],color:number,duration:number):void{
    const count=this.budget(Math.max(from.length,to.length)*2);
    for(let i=0;i<count;i++){
      const node=this.particles[this.cursor++%this.particles.length],a=from[i%from.length],b=to[i%to.length];this.scene.tweens.killTweensOf(node);
      node.setActive(true).setVisible(true).setPosition(a.x,a.y).setTint(color).setScale(.7).setAlpha(.9);
      this.scene.tweens.add({targets:node,x:b.x,y:b.y,alpha:0,duration,ease:'Sine.InOut',onComplete:()=>node.setActive(false).setVisible(false)});
    }
  }
  private nodes(){return [...this.particles,...this.trails,...this.pulses,this.halo,this.shadow];}
  reset():void{this.dragging=false;this.particleCredit=0;for(const node of this.nodes()){this.scene.tweens.killTweensOf(node);node.setVisible(false).setActive(false);}}
  destroy():void{for(const node of this.nodes()){this.scene.tweens.killTweensOf(node);node.destroy();}}
}
