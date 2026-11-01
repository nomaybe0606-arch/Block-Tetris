import { describe, expect, it, vi } from 'vitest';
import { newGame } from '../src/core/game';
import { restoreGame } from '../src/core/serialization';
import type { PlatformPort } from '../src/platform/PlatformService';
import type { RewardedResult } from '../src/platform/RewardedAdService';
import { SwapController, type SwapHost } from '../src/ui/SwapController';

function setup(result:RewardedResult='rewarded'){
  let state={...newGame(42,900),moves:6},selected=0;
  const saves:string[]=[];
  const host:SwapHost={state:()=>state,replace:next=>{state=next;},checkpoint:vi.fn(async()=>{saves.push(JSON.stringify(state));return true;}),selected:()=>selected,select:slot=>{selected=slot;},changed:vi.fn(),animate:vi.fn(async()=>{})};
  const show=vi.fn(async(commit:()=>void|Promise<void>)=>{if(result==='rewarded')await commit();return result;});
  const platform={rewardedSupported:true,showRewarded:show} as unknown as PlatformPort;
  const controller=new SwapController(platform,host);controller.open();
  return {controller,host,show,saves,platform};
}
describe('swap UI persistence boundary',()=>{
  it('saves the frozen preview before requesting ad, then saves reward before animating',async()=>{
    const s=setup(),offer=s.controller.offer;
    s.show.mockImplementationOnce(async commit=>{expect(s.saves).toHaveLength(1);expect(JSON.parse(s.saves[0]).swapOperation.status).toBe('pending');expect(s.controller.busy).toBe(true);await commit();return 'rewarded';});
    await s.controller.watch();
    expect(s.saves).toHaveLength(2);expect(JSON.parse(s.saves[1]).swapsUsed).toBe(1);expect(s.host.state().tray[offer!.slot]).toEqual(offer!.to);
    expect(s.host.animate).toHaveBeenCalledWith(offer);expect(s.controller.busy).toBe(false);
  });
  it('does not show ad when the pre-ad save fails',async()=>{
    const s=setup();vi.mocked(s.host.checkpoint).mockResolvedValue(false);await s.controller.watch();
    expect(s.show).not.toHaveBeenCalled();expect(s.controller.message).toBe('saveRequired');expect(s.host.state().swapOperation).toBeNull();
  });
  it.each(['cancelled','unavailable','failed','busy'] as const)('keeps quota and preview after %s',async result=>{
    const s=setup(result),before=s.host.state();await s.controller.watch();
    expect(s.host.state()).toEqual(before);expect(s.host.animate).not.toHaveBeenCalled();expect(s.controller.busy).toBe(false);
    const offer=s.controller.offer;s.controller.open();expect(s.controller.offer).toEqual(offer);
  });
  it('retains an applied reward on save failure and retries storage without another ad',async()=>{
    const s=setup();vi.mocked(s.host.checkpoint).mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValue(true);
    await s.controller.watch();expect(s.controller.savePending).toBe(true);expect(s.host.state().swapsUsed).toBe(1);expect(s.host.animate).not.toHaveBeenCalled();
    await s.controller.watch();expect(s.show).toHaveBeenCalledTimes(1);
    await s.controller.retrySave();expect(s.controller.savePending).toBe(false);expect(s.show).toHaveBeenCalledTimes(1);expect(s.host.animate).toHaveBeenCalledTimes(1);
    expect(restoreGame(s.host.state())?.swapsUsed).toBe(1);
  });
  it('ignores duplicate rewarded callbacks and a second tap during pre-ad persistence',async()=>{
    const s=setup();let done!:(saved:boolean)=>void;vi.mocked(s.host.checkpoint).mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));
    const first=s.controller.watch();await s.controller.watch();expect(s.show).not.toHaveBeenCalled();
    s.show.mockImplementationOnce(async commit=>{await commit();await commit();return 'rewarded';});done(true);await first;
    expect(s.show).toHaveBeenCalledTimes(1);expect(s.host.state().swapsUsed).toBe(1);
  });
  it('does not trust a rewarded result without the reward callback',async()=>{
    const s=setup();s.show.mockResolvedValueOnce('rewarded');await s.controller.watch();
    expect(s.host.state().swapsUsed).toBe(0);expect(s.host.state().swapOperation).toBeNull();expect(s.controller.message).toBe('adUnavailable');
  });
  it('hides support and refuses an ad on an unsupported platform',async()=>{
    const s=setup();Object.assign(s.platform,{rewardedSupported:false});await s.controller.watch();
    expect(s.controller.model(true,key=>key).supported).toBe(false);expect(s.show).not.toHaveBeenCalled();
  });
});
