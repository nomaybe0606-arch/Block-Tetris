import Phaser from 'phaser';
import { COLORS } from '../config/layout';
import { createFeedbackAtlas } from './FeedbackAtlas';
import { createSpriteAtlas } from './SpriteAtlas';

export function createTextures(scene: Phaser.Scene): void {
  createFeedbackAtlas(scene);
  COLORS.forEach((color, index) => {
    const texture = scene.textures.createCanvas(`block-${index + 1}`, 128, 128)!;
    const ctx = texture.context;
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, Phaser.Display.Color.HexStringToColor(color).lighten(22).rgba);
    gradient.addColorStop(0.38, color);
    gradient.addColorStop(1, Phaser.Display.Color.HexStringToColor(color).darken(34).rgba);
    ctx.fillStyle = '#040a1c'; ctx.beginPath(); ctx.roundRect(2, 5, 124, 122, 19); ctx.fill();
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(3, 2, 122, 119, 18); ctx.fill();
    ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=6;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(4,3,120,117,17);ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle = '#eaffffb0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(6, 4, 116, 113, 15); ctx.stroke();
    const glass=ctx.createLinearGradient(0,8,0,78);glass.addColorStop(0,'#ffffff64');glass.addColorStop(.5,'#ffffff10');glass.addColorStop(1,'#ffffff00');
    ctx.fillStyle=glass;ctx.beginPath();ctx.roundRect(12,10,104,64,12);ctx.fill();
    ctx.fillStyle = '#ffffff70'; ctx.beginPath(); ctx.roundRect(17, 12, 94, 4, 3); ctx.fill();
    ctx.strokeStyle = '#ecffff28'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(16, 19, 96, 84, 11); ctx.stroke();
    ctx.fillStyle = '#080b3038'; ctx.beginPath(); ctx.roundRect(12, 105, 104, 8, 5); ctx.fill();
    ctx.fillStyle='#ffffff29';ctx.beginPath();ctx.ellipse(92,85,15,5,-.45,0,Math.PI*2);ctx.fill();
    texture.refresh();
  });
  const glow=scene.textures.createCanvas('neon-glow',128,128)!;
  const halo=glow.context.createRadialGradient(64,64,2,64,64,64);halo.addColorStop(0,'#ffffffa0');halo.addColorStop(.3,'#ffffff40');halo.addColorStop(1,'#ffffff00');
  glow.context.fillStyle=halo;glow.context.fillRect(0,0,128,128);glow.refresh();
  const line=scene.textures.createCanvas('line-glow',256,24)!,lineCtx=line.context;
  const light=lineCtx.createLinearGradient(0,0,0,24);light.addColorStop(0,'#ffffff00');light.addColorStop(.35,'#ffffff35');light.addColorStop(.5,'#ffffffed');light.addColorStop(.65,'#ffffff35');light.addColorStop(1,'#ffffff00');
  lineCtx.fillStyle=light;lineCtx.fillRect(0,0,256,24);line.refresh();
  const board=scene.textures.createCanvas('board-glass',864,864)!,ctx=board.context;
  const bg=ctx.createLinearGradient(0,0,864,864);bg.addColorStop(0,'#131c3d');bg.addColorStop(.5,'#0b142e');bg.addColorStop(1,'#1b2145');
  ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(1,1,862,862,38);ctx.fill();
  ctx.strokeStyle='#819fff50';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(3,3,858,858,36);ctx.stroke();
  ctx.strokeStyle='#42dfec18';ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(10,10,844,844,30);ctx.stroke();
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const bx=20+x*104,by=20+y*104;
    const cell=ctx.createLinearGradient(bx,by,bx,by+96);cell.addColorStop(0,'#080f27');cell.addColorStop(.15,'#172445');cell.addColorStop(1,'#1e2b4d');
    ctx.fillStyle=cell;ctx.beginPath();ctx.roundRect(bx,by,96,96,14);ctx.fill();
    ctx.strokeStyle='#8eacff25';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#bbdcff0c';ctx.fillRect(bx+13,by+91,70,2);
  }
  board.refresh();
  const dot = scene.add.graphics().fillStyle(0xffffff).fillCircle(4, 4, 4);
  dot.generateTexture('particle', 8, 8); dot.destroy();
  const preview=scene.textures.createCanvas('preview-cell',128,128)!,p=preview.context;
  p.fillStyle='#ffffff';p.globalAlpha=.34;p.beginPath();p.roundRect(2,2,124,124,18);p.fill();p.globalAlpha=.8;p.lineWidth=5;p.strokeStyle='#ffffff';p.stroke();preview.refresh();
  const fill=scene.textures.createCanvas('preview-fill',128,128)!,f=fill.context;f.fillStyle='#ffffff';f.beginPath();f.roundRect(2,2,124,124,18);f.fill();fill.refresh();
  createSpriteAtlas(scene);
}
