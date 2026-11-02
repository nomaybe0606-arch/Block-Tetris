/** GRID_PULSE_DEV_PERF_ONLY — imported only by Vite DEV, never shipped. */
export interface WorkSample {activeEffects:number;activeTweens:number;placementMs:number;clearMs:number}
export class PerfDiagnostics {
  private root=document.createElement('aside');private panel=document.createElement('pre');private frames=0;private elapsed=0;private previous=0;private maximum=0;
  constructor(private read:()=>WorkSample){
    this.root.id='grid-pulse-perf';this.root.style.cssText='position:fixed;right:6px;top:6px;margin:0;padding:8px;z-index:10000;background:#081122df;color:#bffff0;font:11px/1.45 monospace;pointer-events:none;white-space:pre';
    this.panel.style.margin='0';const reset=document.createElement('button');reset.textContent='Reset metrics';reset.style.cssText='pointer-events:auto;font:inherit;margin-top:4px';reset.addEventListener('click',()=>this.reset());
    this.root.append(this.panel,reset);document.body.append(this.root);this.reset();
  }
  frame(paused:boolean):void{
    const now=performance.now();if(paused||document.hidden){this.previous=0;return;}
    if(!this.previous){this.previous=now;return;}
    const delta=now-this.previous;this.previous=now;this.maximum=Math.max(this.maximum,delta);this.frames++;this.elapsed+=delta;
    if(this.elapsed<500)return;
    const work=this.read();this.panel.textContent=`DEV PERF\nFPS ${(this.frames*1000/this.elapsed).toFixed(1)}\nFrame ${(this.elapsed/this.frames).toFixed(2)} ms\nMax frame ${this.maximum.toFixed(2)} ms\nEffects ${work.activeEffects}\nTweens ${work.activeTweens}\nPlace ${work.placementMs.toFixed(3)} ms\nClear ${work.clearMs.toFixed(3)} ms`;
    this.frames=0;this.elapsed=0;
  }
  reset():void{this.frames=0;this.elapsed=0;this.previous=0;this.maximum=0;this.panel.textContent='DEV PERF — waiting for active frames';}
  destroy():void{this.root.remove();}
}
