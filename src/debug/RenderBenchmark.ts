// GRID_TETRIS_RENDER_BENCHMARK_ONLY — separate DEV entry, never part of the game bundle.
import Phaser from 'phaser';
import { createTextures } from '../rendering/textures';
import { BoardRenderer } from '../rendering/BoardRenderer';
import { NeonEffects } from '../rendering/NeonEffects';
import { Feedback } from '../rendering/Feedback';
import { captureClear } from '../rendering/ClearEvent';
import { newGame, placePiece } from '../core/game';
import { getShape } from '../core/shapes';
import { RENDER } from '../rendering/renderConfig';
const panel=document.querySelector('#result')!,button=document.querySelector<HTMLButtonElement>('#run')!;
class Benchmark extends Phaser.Scene{
  private board!:BoardRenderer;private neon!:NeonEffects;private feedback!:Feedback;
  private began=0;private previous=0;private frames:number[]=[];private cpu:number[]=[];private clears=0;private running=false;
  create(){createTextures(this);this.board=new BoardRenderer(this);this.neon=new NeonEffects(this);this.feedback=new Feedback(this,this.neon,this.board.clearLayer);
    const state=newGame(42);state.board=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>y>3&&(x+y)%4?1+(x+y)%7:0));this.board.render(state.board);this.board.renderTray(state,false);this.sampleBoard=state.board;
    button.onclick=()=>{this.feedback.reset();this.frames=[];this.cpu=[];this.clears=0;this.began=this.previous=performance.now();this.running=true;button.disabled=true;panel.textContent='Running… Keep this tab active.';};
  }
  private sampleBoard=newGame(42).board;
  update(){if(!this.running)return;const started=performance.now(),elapsed=started-this.began,delta=started-this.previous;this.previous=started;
    this.frames.push(delta);
    this.neon.configure(false,true,60);
    const shape=getShape('square-3'),x=Math.floor(elapsed/70)%6,y=Math.floor(elapsed/430)%6;
    this.board.showPreview(this.sampleBoard,shape,x,y,true,false);
    const drag=this.board.acquireDrag({shapeId:shape.id,color:2},shape);drag.setPosition(240+140*Math.sin(elapsed/350),420+120*Math.cos(elapsed/480)).setScale(1);
    if(elapsed>=this.clears*600){const before=newGame(42);before.tray=[{shapeId:'line-4-v',color:2},{shapeId:'single',color:3},null];for(let row=0;row<4;row++){before.board[row].fill(1);before.board[row][7]=0;}
      const result=placePiece(before,0,7,0)!;this.feedback.clear(captureClear(result,before.board,2),false);this.clears++;}
    this.feedback.update(delta);this.neon.update(delta);this.cpu.push(performance.now()-started);
    if(elapsed>=12000){this.running=false;this.board.releaseDrag();this.board.clearPreview();button.disabled=false;
      const sorted=this.frames.slice(30).sort((a,b)=>a-b),cpu=this.cpu.slice(30).sort((a,b)=>a-b),q=(values:number[],p:number)=>values[Math.min(values.length-1,Math.floor(values.length*p))];
      this.feedback.reset();this.neon.reset();panel.textContent=JSON.stringify({durationMs:elapsed,frames:sorted.length,clears:this.clears,frameP50:q(sorted,.5),frameP95:q(sorted,.95),frameP99:q(sorted,.99),frameMax:sorted.at(-1),framesOver25:sorted.filter(v=>v>25).length,framesOver50:sorted.filter(v=>v>50).length,updateCpuP95:q(cpu,.95),updateCpuMax:cpu.at(-1)},null,2);
    }
  }
}
if(import.meta.env.DEV)new Phaser.Game({type:Phaser.AUTO,parent:'game',width:480,height:850,transparent:true,render:RENDER,input:{mouse:false,touch:false,keyboard:false},audio:{noAudio:true},scene:[Benchmark]});
