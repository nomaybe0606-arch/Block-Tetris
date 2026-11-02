import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { PerfDiagnostics } from '../src/debug/PerfDiagnostics';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('DEV-only performance panel',()=>{
  it('reports real frame intervals, work counts and resettable maximum, excluding paused time',()=>{
    const dom=new Window();vi.stubGlobal('document',dom.document);let now=100;vi.spyOn(performance,'now').mockImplementation(()=>now);
    const read=vi.fn(()=>({activeEffects:18,activeTweens:3,placementMs:1.25,clearMs:.4})),perf=new PerfDiagnostics(read);
    perf.frame(false);for(let i=0;i<30;i++){now+=20;perf.frame(false);}
    const panel=dom.document.querySelector('#grid-pulse-perf')!;expect(panel.textContent).toContain('FPS 50.0');expect(panel.textContent).toContain('Max frame 20.00 ms');expect(panel.textContent).toContain('Effects 18');expect(panel.textContent).toContain('Place 1.250 ms');
    now+=10000;perf.frame(true);now+=20;perf.frame(false);for(let i=0;i<30;i++){now+=20;perf.frame(false);}expect(panel.textContent).toContain('Max frame 20.00 ms');expect(read.mock.calls.length).toBeLessThan(5);
    dom.document.querySelector('button')!.click();expect(panel.textContent).toContain('waiting');perf.destroy();expect(dom.document.querySelector('#grid-pulse-perf')).toBeNull();dom.close();
  });
});
