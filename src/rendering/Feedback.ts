import Phaser from 'phaser';
import { GRID } from '../config/layout';
import type { Placement } from '../core/types';

export class Feedback {
  constructor(private scene: Phaser.Scene) {}
  placement(result: Placement, color: number, reduced: boolean): void {
    if (reduced) return;
    for (const [x,y] of result.placed) {
      const block = this.scene.add.image(GRID.x+x*52+26,GRID.y+y*52+26,`block-${color}`).setDisplaySize(49,49).setDepth(10);
      this.scene.tweens.add({ targets:block, scaleX:block.scaleX*1.12,scaleY:block.scaleY*1.12, yoyo:true,duration:85,onComplete:()=>block.destroy() });
    }
  }
  clear(result: Placement, reduced: boolean): void {
    const flash=this.scene.add.graphics().setDepth(12);
    for(const [x,y] of result.cleared) flash.fillStyle(0xe6fff9,0.85).fillRoundedRect(GRID.x+x*52+2,GRID.y+y*52+2,48,48,7);
    this.scene.tweens.add({targets:flash,alpha:0,duration:reduced?75:230,onComplete:()=>flash.destroy()});
    if (!reduced) {
      for(const [x,y] of result.cleared) for(let i=0;i<3;i++) {
        const p=this.scene.add.image(GRID.x+x*52+26,GRID.y+y*52+26,'particle').setTint([0x98fff0,0x9d8dff,0xffffff][i]).setScale(0.6+i*0.25).setDepth(13);
        // Cosmetic randomness is independent from the deterministic game RNG.
        this.scene.tweens.add({targets:p,x:p.x+(Math.random()-.5)*100,y:p.y+(Math.random()-.5)*110,alpha:0,scale:0,duration:350+Math.random()*150,onComplete:()=>p.destroy()});
      }
      if(result.rows.length+result.columns.length>1) this.scene.cameras.main.shake(120,0.002);
    }
    const count=result.rows.length+result.columns.length;
    const label=['','Good!','Great!','Excellent!','Amazing!'][Math.min(count,4)];
    const combo=result.state.combo>1?` · Combo ${Math.min(8,result.state.combo)}×`:'';
    const text=this.scene.add.text(240,405,`${label}\n+${result.points}${combo}`,{fontFamily:'Trebuchet MS, sans-serif',fontSize:'34px',fontStyle:'bold',color:'#e2fff5',align:'center',stroke:'#15243d',strokeThickness:6}).setOrigin(.5).setDepth(20);
    this.scene.tweens.add({targets:text,y:reduced?405:370,alpha:0,delay:450,duration:reduced?100:350,onComplete:()=>text.destroy()});
  }
  points(points: number, x: number, y: number, reduced: boolean): void {
    const label=this.scene.add.text(x,y,`+${points}`,{fontFamily:'Trebuchet MS, sans-serif',fontSize:'24px',fontStyle:'bold',color:'#dcdeff',stroke:'#17213d',strokeThickness:4}).setOrigin(.5).setDepth(20);
    this.scene.tweens.add({targets:label,y:reduced?y:y-40,alpha:0,duration:reduced?150:650,onComplete:()=>label.destroy()});
  }
}
