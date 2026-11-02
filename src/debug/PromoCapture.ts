// GRID_PULSE_DEV_PROMO_ONLY — independent DEV entry, never imported by production.
import Phaser from 'phaser';
import {GameScene,type SceneDelegate} from '../scenes/GameScene';
import {newGame,placePiece} from '../core/game';
import {canPlace} from '../core/board';
import {getShape} from '../core/shapes';
import {GRID,TRAY} from '../config/layout';
import type {GameState} from '../core/types';
import type {ClearEvent} from '../rendering/ClearEvent';
if(!import.meta.env.DEV)throw Error('DEV only');
const status=document.querySelector('#status')!;
let scene:GameScene,recording=false,clears=0;
function fixture():GameState{
  const state=newGame(4,2000);state.score=352;state.moves=12;
  state.board[1]=[1,1,1,1,1,1,1,0];state.board[3]=[4,4,4,4,4,0,0,0];
  state.board[5]=[2,2,2,2,2,2,0,0];state.board[6]=[5,5,5,5,5,5,5,0];state.board[7]=[7,7,7,7,7,7,7,0];
  state.tray=[{shapeId:'single',color:3},{shapeId:'line-2-v',color:6},{shapeId:'single',color:2}];return state;
}
const delegate:SceneDelegate={state:fixture(),reducedMotion:()=>false,intenseEffects:()=>true,showSwapControl:()=>false,pixelRatio:()=>1,canInteract:()=>recording&&!delegate.state.over,isTutorial:()=>false,language:()=> 'en',onPick:()=>{},onClearFeedback:(_e:ClearEvent)=>{clears++;},onSettled:()=>{},onReady:s=>{scene=s;s.show(true);s.refresh();status.textContent='Ready. Captures real Phaser rendering, rules and drag controller in real time.';},onPlace:(slot,x,y)=>{const p=placePiece(delegate.state,slot,x,y);if(p)delegate.state=p.state;return p;}};
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:480,height:850,transparent:true,audio:{noAudio:true},fps:{target:60,smoothStep:false},render:{antialias:true,antialiasGL:false},input:{mouse:false,touch:false},scene:[new GameScene(delegate)]});
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function drag(slot:number,x:number,y:number,duration=900):Promise<void>{
  const canvas=game.canvas,rect=canvas.getBoundingClientRect(),shape=getShape(delegate.state.tray[slot]!.shapeId),start={x:TRAY.centers[slot],y:TRAY.y},end={x:GRID.x+(x+shape.width/2)*52,y:GRID.y+(y+shape.height/2)*52};
  // Synthetic QA events cannot obtain browser pointer capture. Only this separate
  // DEV canvas replaces the capture handshake; production DragController is unchanged.
  const send=(type:string,p:{x:number;y:number})=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:1,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,bubbles:true,clientX:rect.left+p.x*rect.width/480,clientY:rect.top+p.y*rect.height/850}));
  send('pointerdown',start);const begun=performance.now();
  await new Promise<void>(resolve=>{const frame=()=>{const t=Math.min(1,(performance.now()-begun)/duration),q=t*t*(3-2*t);send('pointermove',{x:start.x+(end.x-start.x)*q,y:start.y+(end.y-start.y)*q});if(t<1)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});send('pointerup',end);
}
function bestMove(excludeSlot=-1,nonclear=false):{slot:number;x:number;y:number}{
  let best:{slot:number;x:number;y:number;value:number}|null=null;
  for(let slot=0;slot<3;slot++){const piece=delegate.state.tray[slot];if(!piece||slot===excludeSlot)continue;const shape=getShape(piece.shapeId);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){if(!canPlace(delegate.state.board,shape,x,y))continue;const p=placePiece(delegate.state,slot,x,y)!;
      if(nonclear&&p.cleared.length)continue;const value=p.cleared.length*10000+shape.cells.length*10+y;if(!best||value>best.value)best={slot,x,y,value};}}
  if(!best)throw Error('No legal promo move');return best;
}
async function record(format:'landscape'|'portrait'):Promise<void>{
  if(recording||!scene)return;recording=true;clears=0;delegate.state=fixture();scene.refresh();
  game.canvas.setPointerCapture=()=>{};game.canvas.hasPointerCapture=()=>false;
  const landscape=format==='landscape',output=document.createElement('canvas');output.width=landscape?1920:1080;output.height=landscape?1080:1620;
  const ctx=output.getContext('2d')!,cover=new Image();cover.src=`/promo/crazygames/covers/grid-pulse-${format}.png`;await cover.decode();
  const stream=output.captureStream(30),mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))!,recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12_000_000}),chunks:Blob[]=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise<Blob>(resolve=>{recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));});
  const begun=performance.now(),draw=()=>{
    const elapsed=(performance.now()-begun)/1000;
    const gradient=ctx.createLinearGradient(0,0,output.width,output.height);gradient.addColorStop(0,'#201d46');gradient.addColorStop(1,'#103448');ctx.fillStyle=gradient;ctx.fillRect(0,0,output.width,output.height);
    if(landscape){
      const halo=ctx.createRadialGradient(610,660,0,610,660,780);halo.addColorStop(0,'#354e6e');halo.addColorStop(1,'#18203900');ctx.fillStyle=halo;ctx.fillRect(0,0,1920,1080);
      ctx.strokeStyle='#6de9ec22';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-80,800);ctx.bezierCurveTo(700,970,630,160,1940,170);ctx.stroke();ctx.strokeStyle='#b695ef22';ctx.beginPath();ctx.moveTo(-80,900);ctx.bezierCurveTo(800,1040,450,50,1940,75);ctx.stroke();
      ctx.fillStyle='#effaff';ctx.font='bold 112px Trebuchet MS';ctx.fillText('Grid',190,470);ctx.fillStyle='#75e9ed';ctx.fillText('Pulse',190,594);
    }
    const scale=landscape?1.22:1.86,ox=landscape?1000:(1080-480*scale)/2,oy=landscape?20:20;
    ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.drawImage(game.canvas,0,0,480,850);
    ctx.fillStyle='#f4f2ff';ctx.font='bold 21px Trebuchet MS';ctx.fillText('GRID PULSE',32,53);ctx.font='bold 12px Trebuchet MS';ctx.fillStyle='#a4accd';ctx.fillText('SCORE',32,93);ctx.font='bold 60px Trebuchet MS';ctx.fillStyle='#f4f2ff';ctx.fillText(String(delegate.state.score),32,151);
    ctx.fillStyle='#e7cf90';ctx.font='bold 23px Trebuchet MS';ctx.textAlign='right';ctx.fillText(String(delegate.state.best),448,133);ctx.font='10px Trebuchet MS';ctx.fillStyle='#a4accd';ctx.fillText('PERSONAL BEST',448,101);ctx.textAlign='left';ctx.font='11px Trebuchet MS';ctx.fillText('CLASSIC   8 × 8',32,185);ctx.textAlign='right';ctx.fillText(delegate.state.combo>1?`COMBO ×${Math.min(8,delegate.state.combo)}`:`LINES ${delegate.state.lines}`,448,185);ctx.textAlign='center';ctx.fillStyle='#a4accd';ctx.font='11px Trebuchet MS';ctx.fillText('YOUR NEXT MOVES',240,650);ctx.restore();
    // 0.12s exact cover, then a short crossfade into continuous real gameplay.
    if(elapsed<.55){ctx.save();ctx.globalAlpha=elapsed<.12?1:Math.max(0,1-(elapsed-.12)/.43);ctx.drawImage(cover,0,0,output.width,output.height);ctx.restore();}
  };
  game.events.on('postrender',draw);draw();recorder.start(250);status.textContent=`Recording ${format}…`;
  try{
    const at=async(ms:number)=>{await wait(Math.max(0,begun+ms-performance.now()));};
    await at(1500);await drag(0,6,5,1100);
    await at(4900);await drag(1,7,6,1050);
    await at(8500);await drag(2,7,5,950);
    const finisher=bestMove();
    for(const time of [11000,13700]){await at(time);const move=bestMove(finisher.slot,true);await drag(move.slot,move.x,move.y,850);}
    await at(16100);await drag(finisher.slot,finisher.x,finisher.y,850);
    await at(18000);
  }finally{recorder.stop();game.events.off('postrender',draw);recording=false;stream.getTracks().forEach(t=>t.stop());}
  const blob=await stopped,response=await fetch(`/__promo/${format}.webm`,{method:'POST',body:blob});if(!response.ok)throw Error(`Capture upload failed: HTTP ${response.status}`);
  const report={format,moves:delegate.state.moves-12,lines:delegate.state.lines,combo:delegate.state.combo,clearEvents:clears,durationMs:performance.now()-begun,realTime:true};await fetch(`/__promo/${format}.json`,{method:'POST',body:JSON.stringify(report)});status.textContent=JSON.stringify(report,null,2)+'\nSaved to artifacts/crazygames-capture/. Run node scripts/finalize-crazygames-video.mjs';
}
for(const format of ['landscape','portrait'] as const)document.querySelector('#'+format)!.addEventListener('click',()=>{void record(format).catch(e=>{recording=false;status.textContent=String(e);console.error(e);});});
