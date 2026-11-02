import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { hideLoader, loaderStage, resetLoader, LOADER } from '../src/ui/loader';

afterEach(()=>{resetLoader();vi.useRealTimers();vi.unstubAllGlobals();});
function page(now:number){
  vi.useFakeTimers();const dom=new Window();
  dom.document.body.innerHTML='<div id="loader"><h1>GRID</h1><div class="loading-track"><span></span></div></div>';
  vi.stubGlobal('document',dom.document);vi.stubGlobal('performance',{now:()=>now});
  const bar=()=>Number(/scaleX\(([\d.]+)\)/.exec((dom.document.querySelector('.loading-track span') as unknown as HTMLElement).style.transform)?.[1]);
  return {dom,bar,loader:()=>dom.document.querySelector('#loader')};
}
describe('loading screen',()=>{
  it('creeps through each stage without passing it, then fills up on hide',async()=>{
    const {dom,bar}=page(0);
    loaderStage(0.05,0.3);expect(bar()).toBe(0.05);
    await vi.advanceTimersByTimeAsync(LOADER.tickMs*5);const early=bar();expect(early).toBeGreaterThan(0.05);expect(early).toBeLessThan(0.3);
    await vi.advanceTimersByTimeAsync(LOADER.tickMs*200);expect(bar()).toBeLessThanOrEqual(0.3);
    loaderStage(0.45,0.92);expect(bar()).toBe(0.45);
    void hideLoader();expect(bar()).toBe(1);dom.close();
  });
  it('stays for the minimum time on a fast start, then fades out before removal',async()=>{
    const {dom,loader}=page(400);let done=false;void hideLoader().then(()=>{done=true;});
    await vi.advanceTimersByTimeAsync(LOADER.minVisibleMs-400-1);expect(loader()!.classList.contains('loader-hide')).toBe(false);
    await vi.advanceTimersByTimeAsync(1);expect(loader()!.classList.contains('loader-hide')).toBe(true);expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(LOADER.fadeOutMs);expect(loader()).toBeNull();expect(done).toBe(true);dom.close();
  });
  it('after a slow start, only waits for the bar to fill',async()=>{
    const {dom,loader}=page(LOADER.minVisibleMs+3000);void hideLoader();
    await vi.advanceTimersByTimeAsync(LOADER.fillMs-1);expect(loader()!.classList.contains('loader-hide')).toBe(false);
    await vi.advanceTimersByTimeAsync(1);expect(loader()!.classList.contains('loader-hide')).toBe(true);
    await vi.advanceTimersByTimeAsync(LOADER.fadeOutMs);expect(loader()).toBeNull();dom.close();
  });
  it('resolves when there is no loading screen',async()=>{
    const {dom}=page(0);dom.document.body.innerHTML='';await expect(hideLoader()).resolves.toBeUndefined();dom.close();
  });
});
