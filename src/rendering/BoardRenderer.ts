import type Phaser from 'phaser';
import { COLORS, GRID, TRAY } from '../config/layout';
import { ANIMATION } from '../config/animation';
import { FEEDBACK } from '../config/feedback';
import { canPlace, hasMove } from '../core/board';
import { getShape } from '../core/shapes';
import type { Board, Cell, GameState, Piece, Shape } from '../core/types';
import type { DragPose, PieceTransform } from '../input/dragGeometry';
import { trayTransformFor } from './trayLayout';
import { sprite, spriteTexture } from './SpriteAtlas';

export class BoardRenderer {
  readonly root: Phaser.GameObjects.Container;
  readonly clearLayer:Phaser.GameObjects.Container;
  private blocks: Phaser.GameObjects.Container;
  private tray: Phaser.GameObjects.Container;
  private preview: Phaser.GameObjects.Container;
  private tutorial: Phaser.GameObjects.Graphics;
  private slots: (Phaser.GameObjects.Container | null)[] = [];
  private cells=new Map<string,Phaser.GameObjects.Image>();
  private colors=new Uint8Array(64);
  private reflections=new Map<number,Phaser.GameObjects.Image>();
  private slotKeys=['','',''];
  private slotAlphas=[0,0,0];
  private dragNode:Phaser.GameObjects.Container;
  private dragCells:Phaser.GameObjects.Image[]=[];
  private reserveSwapSpace=false;
  private homes:PieceTransform[]=TRAY.centers.map(x=>({x,y:TRAY.y,scale:TRAY.scale}));
  private previewKey='';
  private previewOld:Phaser.GameObjects.Container;
  private previewCells:Phaser.GameObjects.Image[]=[];private previewOldCells:Phaser.GameObjects.Image[]=[];
  private lineCells:Phaser.GameObjects.Image[]=[];private predicted=new Uint8Array(64);
  private previewHalo:Phaser.GameObjects.Image;
  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container();
    const g = scene.add.graphics();
    g.fillStyle(0x060b20, 0.3).fillRoundedRect(22, GRID.y-6, 436, 438, 22);
    g.fillStyle(0x0b1026).fillRoundedRect(24, GRID.y-8, 432, 432, 20);
    g.lineStyle(1.5, 0x6170aa, 0.26).strokeRoundedRect(24, GRID.y-8, 432, 432, 20);
    g.generateTexture('board-frame',480,850);g.destroy();
    const surround=sprite(scene,240,425,'board-frame').setDisplaySize(480,850);
    const ambient=sprite(scene,240,GRID.y+GRID.cell*GRID.size/2,'neon-glow').setTint(0x6b6dff).setDisplaySize(550,590).setAlpha(.17).setBlendMode('ADD');
    const glass=sprite(scene,240,GRID.y+GRID.cell*GRID.size/2,'board-glass').setDisplaySize(432,432);
    const reflectionLayer=scene.add.container();
    this.clearLayer=scene.add.container();this.blocks = scene.add.container(); this.tray = scene.add.container();
    this.tutorial = scene.add.graphics(); this.preview = scene.add.container();this.previewOld=scene.add.container();
    for(let i=0;i<9;i++){const a=sprite(scene,0,0,'preview-cell').setDisplaySize(48,48).setVisible(false),b=sprite(scene,0,0,'preview-cell').setDisplaySize(48,48).setVisible(false);this.preview.add(a);this.previewOld.add(b);this.previewCells.push(a);this.previewOldCells.push(b);}
    const previewLines=scene.add.container();
    for(let i=0;i<64;i++){const cell=sprite(scene,GRID.x+i%8*52+26,GRID.y+Math.floor(i/8)*52+26,'preview-fill').setDisplaySize(48,48).setTint(0xb7fff1).setAlpha(.18).setVisible(false);previewLines.add(cell);this.lineCells.push(cell);}
    this.previewHalo=sprite(scene,0,0,'neon-glow').setBlendMode('ADD').setAlpha(0);
    this.root.add([ambient,surround,glass,this.clearLayer,reflectionLayer,this.blocks,this.tutorial,this.previewHalo,previewLines,this.previewOld,this.preview,this.tray]);
    // Fixed board and drag objects: pointer movement and ordinary moves allocate no images.
    for(let index=0;index<64;index++){
      const x=index%8,y=Math.floor(index/8);
      if(index%4===0){
        const glow=sprite(scene,GRID.x+x*52+26,GRID.y+y*52+26,'neon-glow').setDisplaySize(125,125).setAlpha(.12).setBlendMode('ADD').setVisible(false).setActive(false);
        // Keep all ADD reflections together: interleaving them with cells flushed WebGL every four cells.
        reflectionLayer.add(glow);this.reflections.set(index,glow);
      }
      const block=sprite(scene,GRID.x+x*52+26,GRID.y+y*52+26,'block-1').setDisplaySize(49,49).setVisible(false).setActive(false);
      this.blocks.add(block);this.cells.set(`${x}:${y}`,block);
    }
    this.dragNode=scene.add.container().setDepth(30).setVisible(false).setActive(false);
    for(let i=0;i<9;i++){const block=sprite(scene,0,0,'block-1').setDisplaySize(49,49).setVisible(false);this.dragCells.push(block);this.dragNode.add(block);}
  }
  render(board: Board): void {
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const index=y*8+x,color=board[y][x];if(this.colors[index]===color)continue;
      this.colors[index]=color;
      const block=this.cells.get(`${x}:${y}`)!;
      this.scene.tweens.killTweensOf(block);
      block.setPosition(GRID.x+x*52+26,GRID.y+y*52+26).setVisible(color!==0).setActive(color!==0).setAlpha(1).setDisplaySize(49,49);
      if(color)spriteTexture(block,`block-${color}`);
      const reflection=this.reflections.get(index);
      if(reflection)this.scene.tweens.killTweensOf(reflection);
      reflection?.setVisible(color!==0).setActive(color!==0).setAlpha(.12);
      if(color)reflection?.setTint(parseInt(COLORS[color-1].slice(1),16));
    }
  }
  landCells(cells:Cell[],reduced:boolean,from?:DragPose,shape?:Shape):void{
    if(reduced)return;
    for(const [x,y] of cells){
      const block=this.cells.get(`${x}:${y}`)!;this.scene.tweens.killTweensOf(block);
      if(!block.visible)continue;
      const targetX=GRID.x+x*52+26,targetY=GRID.y+y*52+26;
      if(from&&shape){
        block.setPosition(from.x+(x-from.column-(shape.width-1)/2)*52*from.scale,from.y+(y-from.row-(shape.height-1)/2)*52*from.scale).setDisplaySize(49*from.scale,49*from.scale);
        this.scene.tweens.add({targets:block,x:targetX,y:targetY,scaleX:49/128,scaleY:49/128,duration:90,ease:'Cubic.Out'});
      }else{
        block.setDisplaySize(52,46);
        this.scene.tweens.add({targets:block,scaleX:49/128,scaleY:49/128,duration:ANIMATION.landMs,ease:'Back.Out'});
      }
    }
  }
  clearCells(cells:Cell[],reduced:boolean):void{
    cells.forEach(([x,y],index)=>{
      const block=this.cells.get(`${x}:${y}`);if(!block)return;
      this.scene.tweens.killTweensOf(block);block.setDisplaySize(49,49);
      const delay=reduced?0:Math.min(65,index*5);
      this.scene.tweens.add({targets:block,alpha:0,scaleX:block.scaleX*(reduced?1:.55),scaleY:block.scaleY*(reduced?1:.55),delay,duration:(reduced?FEEDBACK.reducedClearMs:FEEDBACK.clearDurationMs)-delay,ease:'Sine.In'});
      const reflection=this.reflections.get(y*8+x);
      if(reflection)this.scene.tweens.add({targets:reflection,alpha:0,delay,duration:(reduced?FEEDBACK.reducedClearMs:FEEDBACK.clearDurationMs)-delay});
    });
  }
  renderTray(state: GameState, reduced: boolean, animate = false, reserveSwapSpace=false): void {
    const layoutChanged=reserveSwapSpace!==this.reserveSwapSpace;this.reserveSwapSpace=reserveSwapSpace;
    state.tray.forEach((piece, index) => {
      const key=piece?`${piece.shapeId}:${piece.color}`:'',changed=key!==this.slotKeys[index];
      let container=this.slots[index];
      if(changed&&container){this.scene.tweens.killTweensOf(container);container.destroy();container=null;}
      this.slotKeys[index]=key;
      if(!piece){this.slots[index]=null;return;}
      const shape=getShape(piece.shapeId),alpha=hasMove(state.board,shape)?1:.3;
      const home=trayTransformFor(shape,index,reserveSwapSpace);this.homes[index]=home;
      if(!container){container=this.piece(piece,shape);this.tray.add(container);this.slots[index]=container;}
      if(changed||layoutChanged||animate){
        this.scene.tweens.killTweensOf(container);container.setPosition(TRAY.centers[index],home.y).setScale(home.scale).setVisible(true).setAlpha(alpha);
        if(animate&&!reduced){
          container.setAlpha(0).setScale(home.scale*.78).setY(home.y+8);
          this.scene.tweens.add({targets:container,y:home.y,scale:home.scale,alpha,duration:ANIMATION.trayMs,delay:index*ANIMATION.trayStaggerMs,ease:'Cubic.Out'});
        }
      }else{
        // Preserve the actual transform during appearance; hit-testing reads it directly.
        if(alpha!==this.slotAlphas[index]){
          this.scene.tweens.killTweensOf(container);
          if(reduced)container.setPosition(TRAY.centers[index],home.y).setScale(home.scale).setAlpha(alpha);
          else this.scene.tweens.add({targets:container,y:home.y,scale:home.scale,alpha,duration:120,ease:'Sine.Out'});
        }
      }
      this.slotAlphas[index]=alpha;
    });
  }
  acquireDrag(piece:Piece,shape:Shape):Phaser.GameObjects.Container{
    this.scene.tweens.killTweensOf(this.dragNode);
    this.dragCells.forEach((block,index)=>{
      const cell=shape.cells[index];block.setVisible(!!cell);
      if(cell){spriteTexture(block,`block-${piece.color}`);block.setPosition((cell[0]-(shape.width-1)/2)*52,(cell[1]-(shape.height-1)/2)*52);}
    });
    return this.dragNode.setVisible(true).setActive(true);
  }
  releaseDrag():void{this.scene.tweens.killTweensOf(this.dragNode);this.dragNode.setVisible(false).setActive(false);}
  piece(piece: Piece, shape: Shape): Phaser.GameObjects.Container {
    const container = this.scene.add.container();
    for (const [x,y] of shape.cells) container.add(sprite(this.scene,(x-(shape.width-1)/2)*GRID.cell, (y-(shape.height-1)/2)*GRID.cell, `block-${piece.color}`).setDisplaySize(GRID.cell-3,GRID.cell-3));
    return container;
  }
  trayTransform(index: number): PieceTransform | null {
    const piece=this.slots[index];
    return piece?.visible&&piece.scaleX>0?{x:piece.x,y:piece.y,scale:piece.scaleX}:null;
  }
  trayHome(index:number):PieceTransform{return this.homes[index];}
  trayTarget(shape:Shape,index:number):PieceTransform{return trayTransformFor(shape,index,this.reserveSwapSpace);}
  slotVisible(index: number, visible: boolean): void { this.slots[index]?.setVisible(visible); }
  clearPreview(): void {
    this.previewKey='';this.scene.tweens.killTweensOf(this.previewHalo);this.previewHalo.setAlpha(0);
    this.scene.tweens.killTweensOf(this.preview);this.scene.tweens.killTweensOf(this.previewOld);
    this.preview.setAlpha(1);this.previewOld.setAlpha(0);
    for(const cell of this.previewCells)cell.setVisible(false);for(const cell of this.previewOldCells)cell.setVisible(false);for(const cell of this.lineCells)cell.setVisible(false);
  }
  showTutorial(show: boolean): void {
    this.tutorial.clear();
    if (!show) return;
    for (let x=5; x<8; x++) this.tutorial.fillStyle(0x48d8ea, 0.17).fillRoundedRect(GRID.x+x*52+2, GRID.y+6*52+2, 48,48,7)
      .lineStyle(2,0x81e4f2,0.85).strokeRoundedRect(GRID.x+x*52+3,GRID.y+6*52+3,46,46,7);
  }
  showPreview(board: Board, shape: Shape, x: number, y: number, allowed = true, reduced=false): boolean {
    const valid = canPlace(board, shape, x,y) && allowed;
    const key=`${shape.id}:${x}:${y}:${valid}`;
    if(key===this.previewKey)return valid;
    if(!reduced&&this.previewKey){
      const old=this.preview;this.preview=this.previewOld;this.previewOld=old;
      const oldCells=this.previewCells;this.previewCells=this.previewOldCells;this.previewOldCells=oldCells;
      this.scene.tweens.killTweensOf(this.preview);this.scene.tweens.killTweensOf(old);
      old.setAlpha(.2);this.scene.tweens.add({targets:old,alpha:0,duration:ANIMATION.previewMs});
    }
    this.preview.setAlpha(1);for(const cell of this.previewCells)cell.setVisible(false);for(const cell of this.lineCells)cell.setVisible(false);
    this.previewKey=key;
    const color = valid ? 0x78ead5 : 0xf2829f;
    this.scene.tweens.killTweensOf(this.previewHalo);
    if(reduced)this.previewHalo.setAlpha(0);
    else this.scene.tweens.add({targets:this.previewHalo,x:GRID.x+(x+shape.width/2)*52,y:GRID.y+(y+shape.height/2)*52,alpha:valid?.24:.05,duration:ANIMATION.previewMs});
    this.previewHalo.setDisplaySize(shape.width*52+35,shape.height*52+35).setTint(color);
    let index=0;for (const [dx,dy] of shape.cells) {
      const cx=x+dx,cy=y+dy;
      if(cx<0||cy<0||cx>=8||cy>=8) continue;
      this.previewCells[index++].setPosition(GRID.x+cx*52+26,GRID.y+cy*52+26).setTint(color).setAlpha(valid?1:.6).setVisible(true);
    }
    if (valid) {
      for(let row=0;row<8;row++)for(let column=0;column<8;column++)this.predicted[row*8+column]=board[row][column];
      for(const [dx,dy] of shape.cells)this.predicted[(y+dy)*8+x+dx]=1;
      let rows=0,columns=0;
      for(let row=0;row<8;row++){let full=true;for(let column=0;column<8;column++)if(!this.predicted[row*8+column]){full=false;break;}if(full)rows|=1<<row;}
      for(let column=0;column<8;column++){let full=true;for(let row=0;row<8;row++)if(!this.predicted[row*8+column]){full=false;break;}if(full)columns|=1<<column;}
      for(let i=0;i<64;i++)if((rows&(1<<Math.floor(i/8)))||(columns&(1<<(i%8))))this.lineCells[i].setVisible(true);
    }
    return valid;
  }
}
