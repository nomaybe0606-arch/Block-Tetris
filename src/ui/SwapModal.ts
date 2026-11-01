import { COLORS } from '../config/layout';
import { getShape } from '../core/shapes';
import type { Piece, GameState, SwapOffer } from '../core/types';
import type { Copy } from '../localization/strings';
import { icon } from './icons';
import { MONETIZATION } from '../config/monetization';

export interface SwapUI {supported:boolean;visible:boolean;remaining:number;offer:SwapOffer|null;selected:number;busy:boolean;savePending:boolean;message:string}
export function miniPiece(piece:Piece|null):string{
  if(!piece)return '<span class="spent-piece">—</span>';
  const shape=getShape(piece.shapeId);
  return `<span class="mini-piece" style="--piece-color:${COLORS[piece.color-1]};grid-template-columns:repeat(${shape.width},14px);grid-template-rows:repeat(${shape.height},14px)">${shape.cells.map(([x,y])=>`<i style="grid-column:${x+1};grid-row:${y+1}"></i>`).join('')}</span>`;
}
export function swapModal(state:GameState,ui:SwapUI,c:Copy):string{
  const choices=state.tray.map((piece,slot)=>piece?`<button class="swap-choice ${slot===ui.selected?'selected':''}" data-action="swap-select-${slot}" ${ui.busy||ui.savePending?'disabled':''} aria-label="${c.choosePiece} ${slot+1}" aria-pressed="${slot===ui.selected}">${miniPiece(piece)}<span>${slot+1}</span></button>`:'').join('');
  const position=ui.offer?.position;
  return `<div class="modal-heading"><div><p class="eyebrow">NEON GLASS · ${ui.remaining}/${MONETIZATION.maxSwapsPerGame}</p><h2>${c.swapTitle}</h2></div></div>
    <p class="modal-description">${c.swapHelp}</p><div class="swap-choices">${choices}</div>
    <div class="swap-proposal">${miniPiece(ui.offer?.from??null)}${icon('arrow')}${miniPiece(ui.offer?.to??null)}</div>
    <p class="swap-fit">${ui.offer?`${icon('check')}${c.fitsAt} ${position![1]+1} · ${position![0]+1}`:c.noAlternative}</p>
    <p class="swap-message" role="status">${ui.message}</p>
    <button class="primary" data-action="${ui.savePending?'swap-retry':'swap-watch'}" ${(!ui.offer&&!ui.savePending)||ui.busy?'disabled':''}>${icon('video')}<span>${ui.busy?c.adLoading:ui.savePending?c.retrySave:c.watchSwap}</span></button>
    <button class="secondary" data-action="close" ${ui.busy||ui.savePending?'disabled':''}>${c.cancelSwap}</button>`;
}
