import type Phaser from 'phaser';
import { ANIMATION } from '../config/animation';
import { GRID } from '../config/layout';
import { getShape } from '../core/shapes';
import type { SwapOffer } from '../core/types';
import type { BoardRenderer } from './BoardRenderer';
import type { NeonEffects } from './NeonEffects';

export class SwapAnimation {
  private cleanup:(()=>void)|null=null;
  constructor(private scene:Phaser.Scene,private board:BoardRenderer,private neon:NeonEffects){}
  play(offer:SwapOffer,reduced:boolean):Promise<void>{
    this.cancel();
    return new Promise(resolve=>{
      const home=this.board.trayHome(offer.slot),from=getShape(offer.from.shapeId),to=getShape(offer.to.shapeId);
      const old=this.board.piece(offer.from,from).setPosition(home.x,home.y).setScale(home.scale).setDepth(30);
      const next=this.board.piece(offer.to,to).setPosition(home.x,home.y).setScale(home.scale*(reduced?1:.8)).setAlpha(0).setDepth(31);
      this.board.slotVisible(offer.slot,false);
      this.cleanup=()=>{for(const node of [old,next]){this.scene.tweens.killTweensOf(node);node.destroy();}this.cleanup=null;resolve();};
      if(!reduced){
        const points=(s:typeof from)=>s.cells.map(([x,y])=>({x:home.x+(x-(s.width-1)/2)*GRID.cell*home.scale,y:home.y+(y-(s.height-1)/2)*GRID.cell*home.scale}));
        this.neon.pulse(home.x,home.y,160,150,this.neon.color(offer.to.color),.55);
        this.neon.assemble(points(from),points(to),this.neon.color(offer.to.color),ANIMATION.swapMs);
      }
      this.scene.tweens.add({targets:old,alpha:0,duration:reduced?60:160});
      this.scene.tweens.add({targets:next,alpha:1,scale:home.scale,delay:reduced?0:160,duration:reduced?80:ANIMATION.swapMs-160,ease:'Back.Out',onComplete:()=>this.cleanup?.()});
    });
  }
  cancel():void{this.cleanup?.();}
}
