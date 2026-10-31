import type Phaser from 'phaser';
import { GRID } from '../config/layout';
import { FEEDBACK } from '../config/feedback';
import type { Placement } from '../core/types';

export class Feedback {
  private callout: Phaser.GameObjects.Text | null = null;
  constructor(private scene: Phaser.Scene) {}
  placement(result: Placement, color: number, reduced: boolean): void {
    if (reduced) return;
    for (const [x,y] of result.placed) {
      const block = this.scene.add.image(GRID.x+x*52+26,GRID.y+y*52+26,`block-${color}`).setDisplaySize(49,49).setDepth(10);
      this.scene.tweens.add({ targets:block, scaleX:block.scaleX*1.08,scaleY:block.scaleY*1.08, yoyo:true,duration:FEEDBACK.placementPulseMs,ease:'Sine.Out',onComplete:()=>block.destroy() });
    }
  }
  clear(result: Placement, reduced: boolean): void {
    const count=result.rows.length+result.columns.length,multi=count>1;
    const color=multi?0xd1c3ff:0xa4fff0;
    const duration=reduced?FEEDBACK.reducedClearMs:FEEDBACK.clearDurationMs;
    const flash=this.scene.add.graphics().setDepth(12);
    for(const [x,y] of result.cleared) flash.fillStyle(color,reduced?0.22:multi?0.48:0.35).fillRoundedRect(GRID.x+x*52+2,GRID.y+y*52+2,48,48,7);
    this.scene.tweens.add({targets:flash,alpha:0,duration,onComplete:()=>flash.destroy()});
    if (!reduced) {
      for(const row of result.rows)this.lineLight(GRID.x,GRID.y+row*GRID.cell,true,color,multi);
      for(const column of result.columns)this.lineLight(GRID.x+column*GRID.cell,GRID.y,false,color,multi);
      const particles=Math.min(result.cleared.length*2,multi?FEEDBACK.multiLineParticles:FEEDBACK.singleLineParticles);
      for(let i=0;i<particles;i++) {
        const [x,y]=result.cleared[Math.floor(i*result.cleared.length/particles)];
        const p=this.scene.add.image(GRID.x+x*52+26,GRID.y+y*52+26,'particle').setDepth(13);
        // Cosmetic randomness is independent from the deterministic game RNG.
        p.setTint([0x98fff0,0xb6a4ff,0xffffff][i%3]).setScale(0.6+(i%3)*0.2);
        this.scene.tweens.add({targets:p,x:p.x+(Math.random()-.5)*65,y:p.y+(Math.random()-.5)*75,alpha:0,scale:0,duration:240+Math.random()*110,onComplete:()=>p.destroy()});
      }
    }
    const label=['','Good!','Great!','Excellent!','Amazing!'][Math.min(count,4)];
    const combo=result.state.combo>1?` · Combo ${Math.min(8,result.state.combo)}×`:'';
    if(this.callout){this.scene.tweens.killTweensOf(this.callout);this.callout.destroy();}
    const text=this.scene.add.text(240,400,`${label}\n+${result.points}${combo}`,{fontFamily:'Trebuchet MS, sans-serif',fontSize:multi||result.state.combo>1?'28px':'24px',fontStyle:'bold',color:multi?'#e9e1ff':'#d5fff2',align:'center',stroke:'#15243d',strokeThickness:4}).setOrigin(.5).setDepth(20);
    this.callout=text;
    this.scene.tweens.add({targets:text,y:reduced?400:378,alpha:0,delay:FEEDBACK.calloutHoldMs,duration:reduced?100:FEEDBACK.calloutFadeMs,onComplete:()=>{if(this.callout===text)this.callout=null;text.destroy();}});
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
    const label=this.scene.add.text(x,y,`+${points}`,{fontFamily:'Trebuchet MS, sans-serif',fontSize:'24px',fontStyle:'bold',color:'#dcdeff',stroke:'#17213d',strokeThickness:4}).setOrigin(.5).setDepth(20);
    this.scene.tweens.add({targets:label,y:reduced?y:y-40,alpha:0,duration:reduced?150:650,onComplete:()=>label.destroy()});
  }
}
