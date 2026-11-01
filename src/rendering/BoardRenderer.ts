import type Phaser from 'phaser';
import { COLORS, GRID, TRAY } from '../config/layout';
import { ANIMATION } from '../config/animation';
import { FEEDBACK } from '../config/feedback';
import { canPlace, cloneBoard, findLines, hasMove } from '../core/board';
import { getShape } from '../core/shapes';
import type { Board, Cell, GameState, Piece, Shape } from '../core/types';
import type { PieceTransform } from '../input/dragGeometry';

export class BoardRenderer {
  readonly root: Phaser.GameObjects.Container;
  private blocks: Phaser.GameObjects.Container;
  private tray: Phaser.GameObjects.Container;
  private preview: Phaser.GameObjects.Graphics;
  private tutorial: Phaser.GameObjects.Graphics;
  private slots: (Phaser.GameObjects.Container | null)[] = [];
  private cells=new Map<string,Phaser.GameObjects.Image>();
  private colors=new Uint8Array(64);
  private reflections=new Map<number,Phaser.GameObjects.Image>();
  private slotKeys=['','',''];
  private slotAlphas=[0,0,0];
  private dragNode:Phaser.GameObjects.Container;
  private dragCells:Phaser.GameObjects.Image[]=[];
  private home={y:TRAY.y,scale:TRAY.scale};
  private previewKey='';
  private previewOld:Phaser.GameObjects.Graphics;
  private previewHalo:Phaser.GameObjects.Image;
  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container();
    const g = scene.add.graphics();
    g.fillStyle(0x060b20, 0.3).fillRoundedRect(22, 224, 436, 438, 22);
    g.fillStyle(0x0b1026).fillRoundedRect(24, 222, 432, 432, 20);
    g.lineStyle(1.5, 0x6170aa, 0.26).strokeRoundedRect(24, 222, 432, 432, 20);
    // A quiet tray with three generous hit areas, rather than button-shaped pieces.
    TRAY.centers.forEach(x => { g.fillStyle(0x1e2546, 0.46).fillRoundedRect(x-64, 684, 128, 110, 18); });
    g.generateTexture('board-frame',480,850);g.destroy();
    const surround=scene.add.image(240,425,'board-frame').setDisplaySize(480,850);
    const ambient=scene.add.image(240,438,'neon-glow').setTint(0x6b6dff).setDisplaySize(550,590).setAlpha(.17).setBlendMode('ADD');
    const glass=scene.add.image(240,438,'board-glass').setDisplaySize(432,432);
    this.blocks = scene.add.container(); this.tray = scene.add.container();
    this.tutorial = scene.add.graphics(); this.preview = scene.add.graphics();this.previewOld=scene.add.graphics();
    this.previewHalo=scene.add.image(0,0,'neon-glow').setBlendMode('ADD').setAlpha(0);
    this.root.add([ambient,surround,glass,this.blocks,this.tutorial,this.previewHalo,this.previewOld,this.preview,this.tray]);
    // Fixed board and drag objects: pointer movement and ordinary moves allocate no images.
    for(let index=0;index<64;index++){
      const x=index%8,y=Math.floor(index/8);
      if(index%4===0){
        const glow=scene.add.image(GRID.x+x*52+26,GRID.y+y*52+26,'neon-glow').setDisplaySize(125,125).setAlpha(.12).setBlendMode('ADD').setVisible(false).setActive(false);
        this.blocks.add(glow);this.reflections.set(index,glow);
      }
      const block=scene.add.image(GRID.x+x*52+26,GRID.y+y*52+26,'block-1').setDisplaySize(49,49).setVisible(false).setActive(false);
      this.blocks.add(block);this.cells.set(`${x}:${y}`,block);
    }
    this.dragNode=scene.add.container().setDepth(30).setVisible(false).setActive(false);
    for(let i=0;i<9;i++){const block=scene.add.image(0,0,'block-1').setDisplaySize(49,49).setVisible(false);this.dragCells.push(block);this.dragNode.add(block);}
  }
  render(board: Board): void {
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const index=y*8+x,color=board[y][x];if(this.colors[index]===color)continue;
      this.colors[index]=color;
      const block=this.cells.get(`${x}:${y}`)!;
      this.scene.tweens.killTweensOf(block);
      block.setVisible(color!==0).setActive(color!==0).setAlpha(1).setDisplaySize(49,49);
      if(color)block.setTexture(`block-${color}`);
      const reflection=this.reflections.get(index);
      if(reflection)this.scene.tweens.killTweensOf(reflection);
      reflection?.setVisible(color!==0).setActive(color!==0).setAlpha(.12);
      if(color)reflection?.setTint(parseInt(COLORS[color-1].slice(1),16));
    }
  }
  landCells(cells:Cell[],reduced:boolean):void{
    if(reduced)return;
    for(const [x,y] of cells){
      const block=this.cells.get(`${x}:${y}`)!;this.scene.tweens.killTweensOf(block);
      block.setDisplaySize(52,46);
      this.scene.tweens.add({targets:block,scaleX:49/128,scaleY:49/128,duration:ANIMATION.landMs,ease:'Back.Out'});
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
    const home=reserveSwapSpace?{y:722,scale:.52}:{y:TRAY.y,scale:TRAY.scale};
    const layoutChanged=home.y!==this.home.y;this.home=home;
    state.tray.forEach((piece, index) => {
      const key=piece?`${piece.shapeId}:${piece.color}`:'',changed=key!==this.slotKeys[index];
      let container=this.slots[index];
      if(changed&&container){this.scene.tweens.killTweensOf(container);container.destroy();container=null;}
      this.slotKeys[index]=key;
      if(!piece){this.slots[index]=null;return;}
      const shape=getShape(piece.shapeId),alpha=hasMove(state.board,shape)?1:.3;
      if(!container){container=this.piece(piece,shape);this.tray.add(container);this.slots[index]=container;}
      if(changed||layoutChanged||animate){
        this.scene.tweens.killTweensOf(container);container.setPosition(TRAY.centers[index],home.y).setScale(home.scale).setVisible(true).setAlpha(alpha);
        if(animate&&!reduced){
          container.setAlpha(0).setScale(home.scale*.78).setY(home.y+8);
          this.scene.tweens.add({targets:container,y:home.y,scale:home.scale,alpha,duration:ANIMATION.trayMs,delay:index*ANIMATION.trayStaggerMs,ease:'Back.Out'});
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
      if(cell)block.setTexture(`block-${piece.color}`).setPosition((cell[0]-(shape.width-1)/2)*52,(cell[1]-(shape.height-1)/2)*52);
    });
    return this.dragNode.setVisible(true).setActive(true);
  }
  releaseDrag():void{this.scene.tweens.killTweensOf(this.dragNode);this.dragNode.setVisible(false).setActive(false);}
  piece(piece: Piece, shape: Shape): Phaser.GameObjects.Container {
    const container = this.scene.add.container();
    for (const [x,y] of shape.cells) container.add(this.scene.add.image((x-(shape.width-1)/2)*GRID.cell, (y-(shape.height-1)/2)*GRID.cell, `block-${piece.color}`).setDisplaySize(GRID.cell-3,GRID.cell-3));
    return container;
  }
  trayTransform(index: number): PieceTransform | null {
    const piece=this.slots[index];
    return piece?.visible&&piece.alpha>0?{x:piece.x,y:piece.y,scale:piece.scaleX}:null;
  }
  trayHome(index:number):PieceTransform{return {x:TRAY.centers[index],...this.home};}
  slotVisible(index: number, visible: boolean): void { this.slots[index]?.setVisible(visible); }
  clearPreview(): void {
    this.previewKey='';this.scene.tweens.killTweensOf(this.previewHalo);this.previewHalo.setAlpha(0);
    this.scene.tweens.killTweensOf(this.preview);this.scene.tweens.killTweensOf(this.previewOld);
    this.preview.clear().setAlpha(1);this.previewOld.clear().setAlpha(0);
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
      this.scene.tweens.killTweensOf(this.preview);this.scene.tweens.killTweensOf(old);
      old.setAlpha(.2);this.scene.tweens.add({targets:old,alpha:0,duration:ANIMATION.previewMs});
    }
    this.preview.clear().setAlpha(1);
    this.previewKey=key;
    const color = valid ? 0x78ead5 : 0xf2829f;
    this.scene.tweens.killTweensOf(this.previewHalo);
    if(reduced)this.previewHalo.setAlpha(0);
    else this.scene.tweens.add({targets:this.previewHalo,x:GRID.x+(x+shape.width/2)*52,y:GRID.y+(y+shape.height/2)*52,alpha:valid?.24:.05,duration:ANIMATION.previewMs});
    this.previewHalo.setDisplaySize(shape.width*52+35,shape.height*52+35).setTint(color);
    for (const [dx,dy] of shape.cells) {
      const cx=x+dx,cy=y+dy;
      if(cx<0||cy<0||cx>=8||cy>=8) continue;
      this.preview.fillStyle(color, valid ? 0.34 : 0.2).fillRoundedRect(GRID.x+cx*52+2,GRID.y+cy*52+2,48,48,7)
        .lineStyle(2,color,0.8).strokeRoundedRect(GRID.x+cx*52+3,GRID.y+cy*52+3,46,46,7);
    }
    if (valid) {
      const predicted=cloneBoard(board);
      for (const [dx,dy] of shape.cells) predicted[y+dy][x+dx]=1;
      for(const [cx,cy] of findLines(predicted).cells) this.preview.fillStyle(0xb7fff1,0.18).fillRoundedRect(GRID.x+cx*52+2,GRID.y+cy*52+2,48,48,7);
    }
    return valid;
  }
}
