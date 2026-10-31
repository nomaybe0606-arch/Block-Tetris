import Phaser from 'phaser';
import { COLORS } from '../config/layout';

export function createTextures(scene: Phaser.Scene): void {
  COLORS.forEach((color, index) => {
    const texture = scene.textures.createCanvas(`block-${index + 1}`, 128, 128)!;
    const ctx = texture.context;
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, Phaser.Display.Color.HexStringToColor(color).lighten(17).rgba);
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, Phaser.Display.Color.HexStringToColor(color).darken(17).rgba);
    ctx.fillStyle = '#080d25'; ctx.beginPath(); ctx.roundRect(2, 5, 124, 122, 20); ctx.fill();
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(2, 1, 124, 120, 19); ctx.fill();
    ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(4, 3, 120, 116, 17); ctx.stroke();
    ctx.fillStyle = '#ffffff24'; ctx.beginPath(); ctx.roundRect(12, 10, 104, 9, 5); ctx.fill();
    ctx.strokeStyle = '#ffffff12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(17, 21, 94, 83, 10); ctx.stroke();
    ctx.fillStyle = '#0d103921'; ctx.beginPath(); ctx.roundRect(13, 105, 102, 7, 4); ctx.fill();
    texture.refresh();
  });
  const dot = scene.add.graphics().fillStyle(0xffffff).fillCircle(4, 4, 4);
  dot.generateTexture('particle', 8, 8); dot.destroy();
}
