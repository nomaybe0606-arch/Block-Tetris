import type Phaser from 'phaser';
const entries:readonly [string,number,number,number,number][]=[
  ['board-glass',0,0,864,864],...Array.from({length:7},(_,i)=>[`block-${i+1}`,i*128,896,128,128] as [string,number,number,number,number]),
  ['neon-glow',896,896,128,128],['line-glow',0,864,256,24],['particle',256,864,8,8],['preview-cell',896,0,128,128],['preview-fill',896,128,128,128],
];
const names=new Set(entries.map(entry=>entry[0]));
export function createSpriteAtlas(scene:Phaser.Scene):void{
  const atlas=scene.textures.createCanvas('neon-atlas',1024,1024)!;
  for(const [key,x,y,w,h] of entries){atlas.context.drawImage(scene.textures.get(key).getSourceImage() as HTMLCanvasElement,x,y,w,h);atlas.add(key,0,x,y,w,h);}
  atlas.refresh();for(const [key] of entries)scene.textures.remove(key);
}
export function sprite(scene:Phaser.Scene,x:number,y:number,key:string):Phaser.GameObjects.Image{
  return names.has(key)&&scene.textures?.exists('neon-atlas')?scene.add.image(x,y,'neon-atlas',key):scene.add.image(x,y,key);
}
export function spriteTexture(node:Phaser.GameObjects.Image,key:string):void{
  if(node.texture?.key==='neon-atlas'&&names.has(key))node.setTexture('neon-atlas',key);else node.setTexture(key);
}
