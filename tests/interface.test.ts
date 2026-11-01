import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { Interface, type UIModel } from '../src/ui/Interface';
import { defaultProfile } from '../src/platform/profile';
import { newGame } from '../src/core/game';
import { generateSwapOffer } from '../src/core/SwapGenerator';

let dom:Window,now:number,frames:Map<number,FrameRequestCallback>,nextFrame:number;
const cancelMotion=vi.fn();
const animate=vi.fn(()=>({finished:new Promise<void>(()=>{}),cancel:cancelMotion}));
beforeEach(()=>{
  dom=new Window();dom.document.body.innerHTML='<div id="frame"><div id="ui"></div></div>';
  Object.defineProperty(dom.Element.prototype,'animate',{value:animate,configurable:true});
  now=0;nextFrame=0;frames=new Map();animate.mockClear();cancelMotion.mockClear();
  vi.stubGlobal('document',dom.document);vi.spyOn(performance,'now').mockImplementation(()=>now);
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++nextFrame,callback);return nextFrame;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
});
afterEach(()=>{dom.close();vi.restoreAllMocks();vi.unstubAllGlobals();});
const tick=(time:number)=>{now=time;const scheduled=[...frames.values()];frames.clear();for(const callback of scheduled)callback(time);};
function setup(){
  const profile=defaultProfile('en',false),state={...newGame(1),score:100,best:100,moves:6};profile.game=state;
  const model:UIModel={screen:'game',modal:null,state,profile,paused:false,storageAvailable:true,swap:{supported:true,visible:true,remaining:3,offer:generateSwapOffer(state,0),selected:0,busy:false,savePending:false,message:''}};
  const action=vi.fn(),ui=new Interface(action,vi.fn());ui.render(model);return {ui,model,action};
}
describe('stable game interface',()=>{
  it('retains HUD, controls and focus through scores, storage and pause updates',()=>{
    const {ui,model}=setup(),screen=document.querySelector('.game-ui'),score=document.querySelector('#score-value'),swap=document.querySelector('.swap-button');
    const settings=document.querySelector<HTMLButtonElement>('[data-action="settings"]')!;settings.focus();
    for(let i=0;i<20;i++){model.state={...model.state,score:101+i};model.storageAvailable=i%2===0;ui.render(model,true);}
    model.paused=true;ui.render(model);model.paused=false;ui.render(model);
    expect(document.querySelector('.game-ui')).toBe(screen);expect(document.querySelector('#score-value')).toBe(score);expect(document.querySelector('.swap-button')).toBe(swap);expect(document.activeElement).toBe(settings);
  });
  it('continues an in-flight score animation across unrelated renders without flashing the target',()=>{
    const {ui,model}=setup(),score=document.querySelector('#score-value')!;
    model.state={...model.state,score:144};ui.render(model,true);expect(score.textContent).toBe('100');
    tick(80);const progress=Number(score.textContent);expect(progress).toBeGreaterThan(100);expect(progress).toBeLessThan(144);
    model.storageAvailable=false;ui.render(model);expect(Number(score.textContent)).toBe(progress);expect(frames.size).toBe(1);
    tick(240);expect(score.textContent).toBe('144');expect(frames.size).toBe(0);
  });
  it('stops a running counter immediately when Reduced Motion is enabled',()=>{
    const {ui,model}=setup();model.state={...model.state,score:144};ui.render(model,true);tick(40);
    model.profile.settings.reducedMotion=true;ui.render(model);expect(document.querySelector('#score-value')!.textContent).toBe('144');expect(frames.size).toBe(0);
  });
  it('cancels active compositor animations and record glow when Reduced Motion is enabled',()=>{
    const {ui,model}=setup();model.state={...model.state,score:144};ui.render(model,true);ui.record(false);tick(40);
    expect(document.querySelector('.record-active')).not.toBeNull();model.profile.settings.reducedMotion=true;ui.render(model);
    expect(cancelMotion).toHaveBeenCalled();expect(document.querySelector('.record-active')).toBeNull();expect(frames.size).toBe(0);
  });
  it('updates switches without rebuilding the settings dialog or losing keyboard focus',()=>{
    const {ui,model}=setup();model.modal='settings';ui.render(model);tick(16);
    const dialog=document.querySelector('[role="dialog"]'),input=document.querySelector<HTMLInputElement>('[data-setting="sound"]')!;input.focus();
    model.profile.settings.sound=false;ui.render(model);
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);expect(document.querySelector('[data-setting="sound"]')).toBe(input);expect(input.checked).toBe(false);expect(document.activeElement).toBe(input);
  });
  it('keeps the rewarded dialog shell while switching loading and save-retry states',()=>{
    const {ui,model}=setup();model.modal='swap';ui.render(model);const dialog=document.querySelector<HTMLElement>('[role="dialog"]')!,backdrop=document.querySelector('.modal-backdrop');
    model.swap={...model.swap,busy:true};ui.render(model);
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);expect(document.querySelector('.modal-backdrop')).toBe(backdrop);expect(dialog.dataset.dismissible).toBe('false');expect(dialog.querySelector<HTMLButtonElement>('[data-action="swap-watch"]')!.disabled).toBe(true);
    model.swap={...model.swap,busy:false,savePending:true};ui.render(model);expect(dialog.querySelector('[data-action="swap-retry"]')).not.toBeNull();expect(dialog.querySelector<HTMLButtonElement>('[data-action="close"]')!.disabled).toBe(true);
  });
  it('preserves focus trapping and restores the opening control on close',()=>{
    const {ui,model}=setup(),settings=document.querySelector<HTMLButtonElement>('[data-action="settings"]')!;settings.focus();model.modal='settings';ui.render(model);tick(16);
    const controls=document.querySelectorAll<HTMLButtonElement|HTMLInputElement>('[role="dialog"] button,[role="dialog"] input,[role="dialog"] select');controls[controls.length-1].focus();
    dom.document.dispatchEvent(new dom.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));expect(document.activeElement).toBe(controls[0]);
    model.modal=null;ui.render(model);expect(document.activeElement).toBe(settings);
  });
  it('changes language and screen without stale score callbacks or duplicate overlays',()=>{
    const {ui,model}=setup();model.state={...model.state,score:144};ui.render(model,true);
    model.profile.settings.language='ru';model.modal='settings';ui.render(model);tick(240);
    expect(document.documentElement.lang).toBe('ru');expect(document.querySelector('#score-value')!.textContent).toBe('144');expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    model.screen='menu';model.modal=null;ui.render(model);expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);expect(document.querySelectorAll('.menu-screen')).toHaveLength(1);
  });
  it('keeps the record celebration attached through the next score update',()=>{
    const {ui,model}=setup(),record=document.querySelector('.record-pill')!;ui.record(false);tick(16);
    expect(record.classList.contains('record-active')).toBe(true);model.state={...model.state,score:144};ui.render(model,true);
    expect(document.querySelector('.record-pill')).toBe(record);expect(record.classList.contains('record-active')).toBe(true);
  });
});
