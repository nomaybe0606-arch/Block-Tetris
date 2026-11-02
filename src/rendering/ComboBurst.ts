import type Phaser from 'phaser';
import { sprite } from './SpriteAtlas';

export const COMBO_BURST_MS=440;
const colors=[0x8cfff0,0x74e9ff,0xb7a0ff,0xd39aff,0xff9cdd,0xffd586,0xffe5a1];
const directions=Array.from({length:6},(_,i)=>({x:Math.cos(i*Math.PI/3),y:Math.sin(i*Math.PI/3)}));
export function comboStyle(combo:number):{level:number;scale:number;color:number;glow:number}{
  const level=Math.max(2,Math.min(8,Math.floor(combo))),power=(level-2)/6;
  return {level,scale:.76+.39*power,color:colors[level-2],glow:.16+.19*power};
}
export function createComboAtlas(scene:Phaser.Scene):void{
  const atlas=scene.textures.createCanvas('combo-labels',1024,512)!,ctx=atlas.context;
  ctx.font='bold 40px "Trebuchet MS", Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=5;ctx.lineJoin='round';ctx.strokeStyle='#101c38';ctx.fillStyle='#ffffff';
  for(const [column,language] of ['en','ru'].entries())for(let level=2;level<=8;level++){
    const x=column*512,y=(level-2)*64,text=`${language==='ru'?'КОМБО':'COMBO'} ×${level}`;
    ctx.strokeText(text,x+256,y+32);ctx.fillText(text,x+256,y+32);atlas.add(`${language}-${level}`,0,x,y,512,64);
  }
  atlas.refresh();
}
/** One reusable burst: no text rasterization, tweens, filters or model callbacks during play. */
export class ComboBurst{
  readonly root:Phaser.GameObjects.Container;
  private glow:Phaser.GameObjects.Image;private ring:Phaser.GameObjects.Image;private label:Phaser.GameObjects.Image;
  private sparks:Phaser.GameObjects.Image[]=[];private age=-1;private reduced=false;private scale=1;private intensity=0;private glowAlpha=0;
  constructor(scene:Phaser.Scene){
    this.root=scene.add.container().setDepth(21).setVisible(false).setActive(false);
    this.glow=sprite(scene,0,0,'neon-glow').setBlendMode('ADD');this.ring=sprite(scene,0,0,'combo-ring').setBlendMode('ADD');
    this.root.add([this.glow,this.ring]);
    for(let i=0;i<6;i++){const spark=sprite(scene,0,0,'particle').setBlendMode('ADD');this.sparks.push(spark);this.root.add(spark);}
    this.label=scene.add.image(0,0,'combo-labels','en-2');this.root.add(this.label);
  }
  show(combo:number,x:number,y:number,reduced:boolean,language:'en'|'ru',sparkBudget=6):void{
    const style=comboStyle(combo);this.age=0;this.reduced=reduced;this.scale=style.scale;this.intensity=(style.level-2)/6;this.glowAlpha=style.glow;
    this.root.setPosition(x,y).setVisible(true).setActive(true);this.label.setPosition(0,0).setFrame(`${language}-${style.level}`).setTint(style.color).setAlpha(1).setScale(reduced?style.scale:style.scale*.62);
    this.glow.setTint(style.color).setDisplaySize(210+70*this.intensity,90+30*this.intensity).setAlpha(reduced?0:style.glow).setVisible(!reduced);
    this.ring.setTint(style.color).setDisplaySize(110,110).setAlpha(reduced?0:.25+.3*this.intensity).setVisible(!reduced);
    for(let i=0;i<6;i++)this.sparks[i].setTint(style.color).setVisible(!reduced&&i<Math.min(sparkBudget,2+Math.round(4*this.intensity)));
    this.draw(0);
  }
  update(delta:number):void{if(this.age<0)return;this.age+=Math.max(0,delta);const duration=this.reduced?150:COMBO_BURST_MS;if(this.age>=duration){this.reset();return;}this.draw(this.age/duration);}
  private draw(t:number):void{
    this.label.setAlpha(1-t*t);if(this.reduced)return;
    const p=Math.min(1,this.age/150),a=p-1,back=1+2.70158*a*a*a+1.70158*a*a;
    this.label.setScale(this.scale*(.62+.38*back)).setY(-12*t);
    this.glow.setAlpha(this.glowAlpha*(1-t)*(1-t));this.ring.setDisplaySize(110+(100+60*this.intensity)*t,110+(100+60*this.intensity)*t).setAlpha((.25+.3*this.intensity)*(1-t)**2);
    for(let i=0;i<6;i++){const direction=directions[i],radius=45+(45+30*this.intensity)*t;this.sparks[i].setPosition(direction.x*radius,direction.y*radius*.55).setScale(.5+.5*this.intensity).setAlpha(.8*(1-t)**2);}
  }
  reset():void{this.age=-1;this.root.setVisible(false).setActive(false);}
  get playing():boolean{return this.age>=0;}
  get active():number{if(!this.playing)return 0;let count=1;if(this.glow.visible)count++;if(this.ring.visible)count++;for(const spark of this.sparks)if(spark.visible)count++;return count;}
}
