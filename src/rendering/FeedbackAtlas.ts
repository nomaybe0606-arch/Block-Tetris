import type Phaser from 'phaser';

const CHARS='0123456789+ ·Combo×';
const advances=new Map<string,number>();
/** All text rasterization/upload happens at boot, rather than on a scoring move. */
export function createFeedbackAtlas(scene:Phaser.Scene):void{
  const glyphs=scene.textures.createCanvas('feedback-glyphs',CHARS.length*64,64)!;
  const ctx=glyphs.context;ctx.font='bold 24px "Trebuchet MS", Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#15243d';ctx.fillStyle='#eefff9';
  for(let i=0;i<CHARS.length;i++){
    const char=CHARS[i];ctx.strokeText(char,i*64+32,32);ctx.fillText(char,i*64+32,32);
    glyphs.add(i,0,i*64,0,64,64);advances.set(char,ctx.measureText(char).width);
  }
  glyphs.refresh();
  const headlines=scene.textures.createCanvas('feedback-headlines',256,256)!,head=headlines.context;
  head.font='bold 28px "Trebuchet MS", Arial, sans-serif';head.textAlign='center';head.textBaseline='middle';head.lineJoin='round';head.lineWidth=4;head.strokeStyle='#15243d';head.fillStyle='#eefff9';
  ['Good!','Great!','Excellent!','Amazing!'].forEach((word,index)=>{head.strokeText(word,128,index*64+32);head.fillText(word,128,index*64+32);headlines.add(index,0,0,index*64,256,64);});
  headlines.refresh();
}

export class FeedbackLabel {
  readonly root:Phaser.GameObjects.Container;
  private headline:Phaser.GameObjects.Image;
  private glyphs:Phaser.GameObjects.Image[]=[];
  private age=-1;private reduced=false;
  constructor(scene:Phaser.Scene){
    this.root=scene.add.container().setDepth(20).setVisible(false).setActive(false);
    this.headline=scene.add.image(0,-20,'feedback-headlines',0);this.root.add(this.headline);
    for(let i=0;i<32;i++){const glyph=scene.add.image(0,0,'feedback-glyphs',0).setVisible(false);this.glyphs.push(glyph);this.root.add(glyph);}
  }
  show(text:string,x:number,y:number,level:number,reduced:boolean):void{
    this.age=0;this.reduced=reduced;this.root.setPosition(x,y).setVisible(true).setActive(true).setAlpha(1).setScale(reduced?1:.82);
    this.headline.setVisible(level>0);if(level)this.headline.setFrame(level-1);
    let width=0;for(const char of text)width+=advances.get(char)??14;
    let cursor=-width/2;
    for(let i=0;i<this.glyphs.length;i++){
      const char=text[i],glyph=this.glyphs[i];glyph.setVisible(!!char);if(!char)continue;
      const advance=advances.get(char)??14;glyph.setFrame(Math.max(0,CHARS.indexOf(char))).setPosition(cursor+advance/2,level?14:0);cursor+=advance;
    }
  }
  update(delta:number):void{
    if(this.age<0)return;this.age+=delta;const t=Math.min(1,this.age/(this.reduced?150:390));
    this.root.setAlpha(1-t*t);if(!this.reduced){this.root.y-=delta*.055;const p=Math.min(1,this.age/140);this.root.setScale(1-.18*(1-p)**3);}
    if(t===1)this.reset();
  }
  reset():void{this.age=-1;this.root.setVisible(false).setActive(false);}
  get active():number{if(this.age<0)return 0;let count=this.headline.visible?1:0;for(const glyph of this.glyphs)if(glyph.visible)count++;return count;}
  get playing():boolean{return this.age>=0;}
}
