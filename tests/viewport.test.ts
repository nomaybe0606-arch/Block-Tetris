import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
const captured=vi.hoisted(()=>({config:null as Record<string,unknown>|null}));
vi.mock('phaser',()=>({default:{AUTO:0,Scale:{NONE:0},Scene:class{},Game:class{canvas=document.createElement('canvas');constructor(config:Record<string,unknown>){captured.config=config;}}}}));
vi.mock('../src/audio/AudioService',()=>({AudioService:class{}}));
import { App } from '../src/App';
import { MemoryPlatform } from '../src/platform/PlatformService';
import { defaultProfile } from '../src/platform/profile';
import { fitFrameWhileLoading } from '../src/ui/frameFit';

afterEach(()=>{vi.unstubAllGlobals();});
describe('actual app mobile viewport',()=>{
  it('uses displayed dimensions for backing resolution and ignores no-op viewport resize events',()=>{
    const dom=new Window();dom.document.body.innerHTML='<div id="viewport" style="padding:0px"><div id="frame"><div id="ui"></div></div></div>';
    vi.stubGlobal('window',dom);vi.stubGlobal('document',dom.document);vi.stubGlobal('getComputedStyle',dom.getComputedStyle.bind(dom));
    Object.defineProperty(dom,'devicePixelRatio',{value:3});const viewport=dom.document.querySelector('#viewport')!;
    let width=390;Object.defineProperty(viewport,'clientWidth',{get:()=>width});Object.defineProperty(viewport,'clientHeight',{value:700});
    const app=new App(new MemoryPlatform(),defaultProfile('en',false));
    expect(captured.config!.width).toBe(780);expect(captured.config!.height).toBe(1381.25);
    expect(captured.config!.render).toMatchObject({antialias:true,antialiasGL:false});expect(captured.config!.input).toMatchObject({touch:false,mouse:false});
    const cancel=vi.fn();Object.assign(app,{scene:{cancel}});
    for(let i=0;i<10;i++)dom.dispatchEvent(new dom.Event('resize'));expect(cancel).not.toHaveBeenCalled();
    width=320;dom.dispatchEvent(new dom.Event('resize'));expect(cancel).toHaveBeenCalledTimes(1);
    expect((dom.document.querySelector('#frame') as unknown as HTMLElement).style.transform).toContain('scale(0.6666666666666666)');
    // The existing GPU buffer is kept during rotation/toolbar changes; no resize stall is introduced.
    expect(app.pixelRatio()).toBe(1.625);dom.close();
  });
  it('centers and scales the loading screen before the game starts',()=>{
    const dom=new Window();dom.document.body.innerHTML='<div id="viewport" style="padding:0px"><div id="frame"></div></div>';
    vi.stubGlobal('window',dom);vi.stubGlobal('document',dom.document);vi.stubGlobal('getComputedStyle',dom.getComputedStyle.bind(dom));
    const viewport=dom.document.querySelector('#viewport')!,frame=dom.document.querySelector('#frame') as unknown as HTMLElement;
    let width=390;Object.defineProperty(viewport,'clientWidth',{get:()=>width});Object.defineProperty(viewport,'clientHeight',{value:844});
    const stop=fitFrameWhileLoading();
    expect(frame.style.left).toBe('195px');expect(frame.style.top).toBe('422px');expect(frame.style.transform).toBe('translate(-50%, -50%) scale(0.8125)');
    width=1000;dom.dispatchEvent(new dom.Event('resize'));expect(frame.style.left).toBe('500px');
    stop();width=600;dom.dispatchEvent(new dom.Event('resize'));expect(frame.style.left).toBe('500px');dom.close();
  });
});
