import { vi } from 'vitest';
import type Phaser from 'phaser';

export class RenderNode {
  x=0;y=0;scaleX=1;scaleY=1;alpha=1;visible=true;active=true;destroyed=false;tintTopLeft=0;text='';
  list:RenderNode[]=[];parent:RenderNode|null=null;textUpdates=0;
  blendMode='NORMAL';
  constructor(readonly kind:string,public key=''){}
  setPosition(x:number,y:number){this.x=x;this.y=y;return this;}
  setY(y:number){this.y=y;return this;}
  setScale(x:number,y=x){this.scaleX=x;this.scaleY=y;return this;}
  setDisplaySize(w:number,h:number){return this.setScale(w/128,h/128);}
  setAlpha(alpha:number){this.alpha=alpha;return this;}
  setVisible(visible:boolean){this.visible=visible;return this;}
  setActive(active:boolean){this.active=active;return this;}
  setTexture(key:string){this.key=key;return this;}
  setFrame(){return this;}
  setTint(color:number){this.tintTopLeft=color;return this;}
  setText(text:string){this.text=text;this.textUpdates++;return this;}
  setDepth(){return this;}setBlendMode(mode:string){this.blendMode=mode;return this;}setOrigin(){return this;}setAngle(){return this;}
  fillStyle(){return this;}lineStyle(){return this;}fillRoundedRect(){return this;}strokeRoundedRect(){return this;}
  clear(){return this;}generateTexture(){return this;}
  add(value:RenderNode|RenderNode[]){for(const node of Array.isArray(value)?value:[value]){node.parent=this;this.list.push(node);}return this;}
  destroy(){this.destroyed=true;if(this.parent)this.parent.list=this.parent.list.filter(node=>node!==this);for(const node of [...this.list])node.destroy();}
}
export function renderScene(){
  let peakTweens=0,liveTweens=0;
  const nodes:RenderNode[]=[],active=new Map<RenderNode,Record<string,unknown>[]>(),tweens:Record<string,unknown>[]=[];
  const make=(kind:string,key='')=>{const node=new RenderNode(kind,key);nodes.push(node);return node;};
  const scene={
    add:{container:vi.fn(()=>make('container')),graphics:vi.fn(()=>make('graphics')),image:vi.fn((x:number,y:number,key:string)=>make('image',key).setPosition(x,y)),text:vi.fn((x:number,y:number,text:string)=>make('text').setPosition(x,y).setText(text)),rectangle:vi.fn(()=>make('rectangle'))},
    tweens:{killTweensOf:vi.fn((node:RenderNode)=>{liveTweens-=active.get(node)?.length??0;active.delete(node);}),add:vi.fn((config:Record<string,unknown>)=>{tweens.push(config);const node=config.targets as RenderNode;active.set(node,[...(active.get(node)??[]),config]);liveTweens++;peakTweens=Math.max(peakTweens,liveTweens);return config;})},
  };
  const complete=()=>{for(const [node,list] of [...active]){liveTweens-=list.length;active.delete(node);for(const tween of list){for(const key of ['x','y','alpha','scaleX','scaleY'] as const)if(typeof tween[key]==='number')node[key]=tween[key];if(typeof tween.scale==='number')node.setScale(tween.scale);(tween.onComplete as (()=>void)|undefined)?.();}}};
  return {scene:scene as unknown as Phaser.Scene,raw:scene,nodes,tweens,active,complete,get peakTweens(){return peakTweens;},resetPeak:()=>{peakTweens=liveTweens;}};
}
