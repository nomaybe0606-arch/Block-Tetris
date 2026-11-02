import type Phaser from 'phaser';
import { GRID } from '../config/layout';
import { FEEDBACK } from '../config/feedback';
import type { Placement } from '../core/types';
import type { NeonEffects } from './NeonEffects';
import { ClearEffects } from './ClearEffects';
import { captureClear, type ClearEvent } from './ClearEvent';

export class Feedback {
  private runtime:ClearEffects|null=null;
  private callout: Phaser.GameObjects.Text | null = null;
  private pointLabel:Phaser.GameObjects.Text|null=null;
  private flash:Phaser.GameObjects.Graphics|null=null;
  private lines:{beam:Phaser.GameObjects.Image;glint:Phaser.GameObjects.Image}[]=[];
  constructor(private scene: Phaser.Scene,private neon?:NeonEffects,layer?:Phaser.GameObjects.Container,language:()=> 'en'|'ru'=()=> 'en') {
    if(neon){
      this.runtime=new ClearEffects(scene,layer??scene.add.container().setDepth(8),count=>neon.budget(count),language);
    }
  }
  clear(input: Placement|ClearEvent, reduced: boolean,onStart?:()=>void): void {
    if(this.runtime){this.runtime.clear('cells' in input?input:captureClear(input,input.state.board,1),reduced,onStart);return;}
    const result=input as Placement;
    const count=result.rows.length+result.columns.length,multi=count>1;
    const color=multi?0xd1c3ff:0xa4fff0;
    const duration=reduced?FEEDBACK.reducedClearMs:FEEDBACK.clearDurationMs;
    const flash=this.flash??this.scene.add.graphics().setDepth(12);
    this.scene.tweens.killTweensOf(flash);flash.clear().setAlpha(1).setVisible(true).setActive(true);
    for(const line of this.lines)for(const node of [line.beam,line.glint]){this.scene.tweens.killTweensOf(node);node.setVisible(false).setActive(false);}
    for(const [x,y] of result.cleared) flash.fillStyle(color,reduced?0.22:multi?0.58:0.43).fillRoundedRect(GRID.x+x*52+2,GRID.y+y*52+2,48,48,7);
    this.scene.tweens.add({targets:flash,alpha:0,duration,onComplete:()=>{if(this.flash)flash.setVisible(false).setActive(false);else flash.destroy();}});
    if (!reduced) {
      let index=0;
      for(const row of result.rows){if(this.neon)this.pooledLine(index++,GRID.x,GRID.y+row*GRID.cell,true,color,multi);else this.lineLight(GRID.x,GRID.y+row*GRID.cell,true,color,multi);}
      for(const column of result.columns){if(this.neon)this.pooledLine(index++,GRID.x+column*GRID.cell,GRID.y,false,color,multi);else this.lineLight(GRID.x+column*GRID.cell,GRID.y,false,color,multi);}
      const particles=Math.min(result.cleared.length*2,multi?FEEDBACK.multiLineParticles:FEEDBACK.singleLineParticles);
      for(let i=0;i<particles;i++) {
        const [x,y]=result.cleared[Math.floor(i*result.cleared.length/particles)];
        if(this.neon){this.neon.emit(GRID.x+x*52+26,GRID.y+y*52+26,color,1);continue;}
        const p=this.scene.add.image(GRID.x+x*52+26,GRID.y+y*52+26,'particle').setDepth(13);
        // Cosmetic randomness is independent from the deterministic game RNG.
        p.setTint([0x98fff0,0xb6a4ff,0xffffff][i%3]).setScale(0.6+(i%3)*0.2);
        this.scene.tweens.add({targets:p,x:p.x+(Math.random()-.5)*65,y:p.y+(Math.random()-.5)*75,alpha:0,scale:0,duration:240+Math.random()*110,onComplete:()=>p.destroy()});
      }
    }
    const level=Math.min(4,Math.max(count,result.state.combo>=4?3:result.state.combo>=2?2:1));
    const label=['','Good!','Great!','Excellent!','Amazing!'][level];
    const combo=result.state.combo>1?` · Combo ${Math.min(8,result.state.combo)}×`:'';
    if(this.callout){this.scene.tweens.killTweensOf(this.callout);if(!this.neon)this.callout.destroy();}
    const text=this.neon?this.callout!.setText(`${label}\n+${result.points}${combo}`).setPosition(240,400).setVisible(true).setActive(true).setAlpha(1):this.scene.add.text(240,400,`${label}\n+${result.points}${combo}`,{fontFamily:'Trebuchet MS, sans-serif',fontSize:multi||result.state.combo>1?'28px':'24px',fontStyle:'bold',color:multi?'#e9e1ff':'#d5fff2',align:'center',stroke:'#15243d',strokeThickness:4}).setOrigin(.5).setDepth(20);
    this.callout=text;
    text.setScale(!reduced&&this.neon ? .82 : 1);
    if(!reduced&&this.neon)this.scene.tweens.add({targets:text,scale:1,duration:140,ease:'Back.Out'});
    this.scene.tweens.add({targets:text,y:reduced?400:378,alpha:0,delay:FEEDBACK.calloutHoldMs,duration:reduced?100:FEEDBACK.calloutFadeMs,onComplete:()=>{if(this.neon)text.setVisible(false).setActive(false);else{if(this.callout===text)this.callout=null;text.destroy();}}});
  }
  private pooledLine(index:number,x:number,y:number,horizontal:boolean,color:number,multi:boolean):void{
    const {beam,glint}=this.lines[index],span=GRID.cell*GRID.size;
    beam.setPosition(x+(horizontal?span/2:26),y+(horizontal?26:span/2)).setDisplaySize(span-4,multi?32:24).setAngle(horizontal?0:90).setTint(color).setAlpha(multi?.78:.55).setVisible(true).setActive(true);
    glint.setPosition(x+26,y+26).setDisplaySize(64,14).setAngle(horizontal?0:90).setTint(color).setAlpha(.95).setVisible(true).setActive(true);
    this.scene.tweens.add({targets:beam,alpha:0,duration:FEEDBACK.clearDurationMs,onComplete:()=>beam.setVisible(false).setActive(false)});
    this.scene.tweens.add({targets:glint,x:x+(horizontal?span-26:26),y:y+(horizontal?26:span-26),alpha:0,duration:FEEDBACK.sweepDurationMs,ease:'Sine.Out',onComplete:()=>glint.setVisible(false).setActive(false)});
  }
  private lineLight(x:number,y:number,horizontal:boolean,color:number,multi:boolean):void{
    const span=GRID.cell*GRID.size;
    const light=this.scene.add.graphics().setDepth(14);
    light.fillStyle(color,multi?0.13:0.08).fillRoundedRect(x+2,y+2,horizontal?span-4:GRID.cell-4,horizontal?GRID.cell-4:span-4,7);
    light.fillStyle(color,multi?0.4:0.26).fillRoundedRect(x+(horizontal?2:GRID.cell/2-3),y+(horizontal?GRID.cell/2-3:2),horizontal?span-4:6,horizontal?6:span-4,3);
    this.scene.tweens.add({targets:light,alpha:0,duration:FEEDBACK.clearDurationMs,onComplete:()=>light.destroy()});
    const glint=this.scene.add.rectangle(x+GRID.cell/2,y+GRID.cell/2,horizontal?42:4,horizontal?4:42,color,.9).setDepth(15);
    this.scene.tweens.add({targets:glint,x:x+(horizontal?span-GRID.cell/2:GRID.cell/2),y:y+(horizontal?GRID.cell/2:span-GRID.cell/2),alpha:0,duration:FEEDBACK.sweepDurationMs,ease:'Sine.Out',onComplete:()=>glint.destroy()});
  }
  points(points: number, x: number, y: number, reduced: boolean): void {
    if(this.runtime){this.runtime.showPoints(points,x,y,reduced);return;}
    if(this.pointLabel)this.scene.tweens.killTweensOf(this.pointLabel);
    const label=this.pointLabel?this.pointLabel.setText(`+${points}`).setPosition(x,y).setAlpha(1).setVisible(true).setActive(true):this.scene.add.text(x,y,`+${points}`,{fontFamily:'Trebuchet MS, sans-serif',fontSize:'24px',fontStyle:'bold',color:'#dcdeff',stroke:'#17213d',strokeThickness:4}).setOrigin(.5).setDepth(20);
    this.scene.tweens.add({targets:label,y:reduced?y:y-30,alpha:0,duration:reduced?150:450,onComplete:()=>{if(this.pointLabel)label.setVisible(false).setActive(false);else label.destroy();}});
  }
  reset():void{
    if(this.runtime){this.runtime.reset();return;}
    for(const label of [this.callout,this.pointLabel])if(label){this.scene.tweens.killTweensOf(label);label.setVisible(false).setActive(false);}
    if(this.flash){this.scene.tweens.killTweensOf(this.flash);this.flash.clear().setVisible(false).setActive(false);}
    for(const line of this.lines)for(const node of [line.beam,line.glint]){this.scene.tweens.killTweensOf(node);node.setVisible(false).setActive(false);}
  }
  update(delta:number):void{this.runtime?.update(delta);}
  get active():number{return this.runtime?.active??0;}
}
