import Phaser from 'phaser';
import { GRID, TRAY } from '../config/layout';
import { canPlace, cloneBoard, findLines, hasMove } from '../core/board';
import { getShape } from '../core/shapes';
import type { Board, GameState, Piece, Shape } from '../core/types';
import type { PieceTransform } from '../input/dragGeometry';

export class BoardRenderer {
  readonly root: Phaser.GameObjects.Container;
  private blocks: Phaser.GameObjects.Container;
  private tray: Phaser.GameObjects.Container;
  private preview: Phaser.GameObjects.Graphics;
  private tutorial: Phaser.GameObjects.Graphics;
  private slots: (Phaser.GameObjects.Container | null)[] = [];
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
    this.blocks = scene.add.container(); this.tray = scene.add.container();
    this.tutorial = scene.add.graphics(); this.preview = scene.add.graphics();
    this.root.add([g, this.blocks, this.tutorial, this.preview, this.tray]);
  }
  render(board: Board): void {
    this.blocks.removeAll(true);
    for (let y=0; y<8; y++) for (let x=0; x<8; x++) if (board[y][x]) {
      const block = this.scene.add.image(GRID.x+x*52+26, GRID.y+y*52+26, `block-${board[y][x]}`).setDisplaySize(49,49);
      this.blocks.add(block);
    }
  }
  renderTray(state: GameState, reduced: boolean, animate = false): void {
    this.tray.removeAll(true); this.slots = [];
    state.tray.forEach((piece, index) => {
      if (!piece) { this.slots.push(null); return; }
      const shape = getShape(piece.shapeId), container = this.piece(piece, shape);
      container.setPosition(TRAY.centers[index], TRAY.y).setScale(TRAY.scale);
      if (!hasMove(state.board, shape)) container.setAlpha(0.3);
      this.tray.add(container); this.slots.push(container);
      if (animate && !reduced) {
        const alpha = container.alpha;
        container.setAlpha(0).setScale(0.4);
        this.scene.tweens.add({ targets: container, scale: TRAY.scale, alpha, duration: 230, delay: index*45, ease: 'Back.Out' });
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
  slotVisible(index: number, visible: boolean): void { this.slots[index]?.setVisible(visible); }
  clearPreview(): void { this.preview.clear(); }
  showTutorial(show: boolean): void {
    this.tutorial.clear();
    if (!show) return;
    for (let x=5; x<8; x++) this.tutorial.fillStyle(0x48d8ea, 0.17).fillRoundedRect(GRID.x+x*52+2, GRID.y+6*52+2, 48,48,7)
      .lineStyle(2,0x81e4f2,0.85).strokeRoundedRect(GRID.x+x*52+3,GRID.y+6*52+3,46,46,7);
  }
  showPreview(board: Board, shape: Shape, x: number, y: number, allowed = true): boolean {
    this.preview.clear();
    const valid = canPlace(board, shape, x,y) && allowed;
    const color = valid ? 0x78ead5 : 0xf2829f;
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
