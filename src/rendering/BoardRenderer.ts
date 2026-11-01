import Phaser from 'phaser';
import { GRID, TRAY } from '../config/layout';
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
  private home={y:TRAY.y,scale:TRAY.scale};
  private previewKey='';
  private previewOld:Phaser.GameObjects.Graphics|null=null;
  private previewHalo:Phaser.GameObjects.Image;
  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container();
    const g = scene.add.graphics();
    g.fillStyle(0x060b20, 0.3).fillRoundedRect(22, 224, 436, 438, 22);
    g.fillStyle(0x0b1026).fillRoundedRect(24, 222, 432, 432, 20);
    g.lineStyle(1.5, 0x6170aa, 0.26).strokeRoundedRect(24, 222, 432, 432, 20);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle((x+y)%2 ? 0x1b2443 : 0x1d2748).fillRoundedRect(GRID.x + x*52 + 2, GRID.y + y*52 + 2, 48, 48, 7);
      g.lineStyle(1, 0x53618f, 0.12).strokeRoundedRect(GRID.x+x*52+2, GRID.y+y*52+2, 48, 48, 7);
    }
    // A quiet tray with three generous hit areas, rather than button-shaped pieces.
    TRAY.centers.forEach(x => { g.fillStyle(0x1e2546, 0.46).fillRoundedRect(x-64, 684, 128, 110, 18); });
    const ambient=scene.add.image(240,438,'neon-glow').setTint(0x6b6dff).setDisplaySize(550,590).setAlpha(.17).setBlendMode('ADD');
    const glass=scene.add.image(240,438,'board-glass').setDisplaySize(432,432);
    this.blocks = scene.add.container(); this.tray = scene.add.container();
    this.tutorial = scene.add.graphics(); this.preview = scene.add.graphics();
    this.previewHalo=scene.add.image(0,0,'neon-glow').setBlendMode('ADD').setAlpha(0);
    this.root.add([ambient,g,glass,this.blocks,this.tutorial,this.previewHalo,this.preview,this.tray]);
  }
  render(board: Board): void {
    for(const block of this.cells.values())this.scene.tweens.killTweensOf(block);
    this.cells.clear();
    this.blocks.removeAll(true);
    let lit=0;
    for (let y=0; y<8; y++) for (let x=0; x<8; x++) if (board[y][x]) {
      if(lit++%4===0)this.blocks.add(this.scene.add.image(GRID.x+x*52+26,GRID.y+y*52+26,'neon-glow').setDisplaySize(125,125).setTint([0x9e7bff,0x32caff,0xffbe55,0xf06bb4,0x32dcc3,0x4f91ff,0xcd71fa][board[y][x]-1]).setAlpha(.12).setBlendMode('ADD'));
      const block = this.scene.add.image(GRID.x+x*52+26, GRID.y+y*52+26, `block-${board[y][x]}`).setDisplaySize(49,49);
      this.blocks.add(block);
      this.cells.set(`${x}:${y}`,block);
    }
  }
  clearCells(cells:Cell[],reduced:boolean):void{
    cells.forEach(([x,y],index)=>{
      const block=this.cells.get(`${x}:${y}`);if(!block)return;
      const delay=reduced?0:Math.min(45,index*3);
      this.scene.tweens.add({targets:block,alpha:0,scaleX:block.scaleX*(reduced?1:.83),scaleY:block.scaleY*(reduced?1:.83),delay,duration:(reduced?FEEDBACK.reducedClearMs:FEEDBACK.clearDurationMs)-delay,ease:'Sine.Out'});
    });
  }
  renderTray(state: GameState, reduced: boolean, animate = false, reserveSwapSpace=false): void {
    this.home=reserveSwapSpace?{y:722,scale:.52}:{y:TRAY.y,scale:TRAY.scale};
    this.tray.removeAll(true); this.slots = [];
    state.tray.forEach((piece, index) => {
      if (!piece) { this.slots.push(null); return; }
      const shape = getShape(piece.shapeId), container = this.piece(piece, shape);
      container.setPosition(TRAY.centers[index], this.home.y).setScale(this.home.scale);
      if (!hasMove(state.board, shape)) container.setAlpha(0.3);
      this.tray.add(container); this.slots.push(container);
      if (animate && !reduced) {
        const alpha = container.alpha;
        container.setAlpha(0).setScale(0.4);
        this.scene.tweens.add({ targets: container, scale:this.home.scale, alpha, duration: 230, delay: index*45, ease: 'Back.Out' });
      }
    });
  }
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
    this.previewKey='';this.preview.clear();this.scene.tweens.killTweensOf(this.previewHalo);this.previewHalo.setAlpha(0);
    if(this.previewOld){this.scene.tweens.killTweensOf(this.previewOld);this.previewOld.destroy();this.previewOld=null;}
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
      if(this.previewOld){this.scene.tweens.killTweensOf(this.previewOld);this.previewOld.destroy();}
      const old=this.preview;this.previewOld=old;old.setAlpha(.22);
      this.scene.tweens.add({targets:old,alpha:0,duration:70,onComplete:()=>{if(this.previewOld===old)this.previewOld=null;old.destroy();}});
      this.preview=this.scene.add.graphics();this.root.add(this.preview);
    }else this.preview.clear();
    this.previewKey=key;
    const color = valid ? 0x78ead5 : 0xf2829f;
    this.scene.tweens.killTweensOf(this.previewHalo);
    if(reduced)this.previewHalo.setAlpha(0);
    else this.scene.tweens.add({targets:this.previewHalo,x:GRID.x+(x+shape.width/2)*52,y:GRID.y+(y+shape.height/2)*52,alpha:valid?.18:.05,duration:70});
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
