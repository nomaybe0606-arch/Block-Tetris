import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardedAdService } from '../src/platform/RewardedAdService';
import { MONETIZATION } from '../src/config/monetization';

function setup(){
  let listener:(state:string)=>void=()=>{};
  const off=vi.fn(),busy=vi.fn(),adapter={supported:()=>true,blocked:()=>false,show:vi.fn(),subscribe:vi.fn((next:(state:string)=>void)=>{listener=next;return off;})};
  return {adapter,off,busy,service:new RewardedAdService(adapter,busy),emit:(state:string)=>listener(state)};
}
afterEach(()=>vi.useRealTimers());
describe('rewarded ad transaction',()=>{
  it('grants once only on rewarded, waits for save and closes with cleanup',async()=>{
    const s=setup();let saved!:()=>void;const commit=vi.fn(()=>new Promise<void>(r=>{saved=r;}));
    const result=s.service.request('piece_swap',commit);expect(s.adapter.show).toHaveBeenCalledWith('piece_swap');
    expect(s.service.busy).toBe(true);s.emit('loading');s.emit('opened');expect(commit).not.toHaveBeenCalled();
    s.emit('rewarded');s.emit('rewarded');s.emit('closed');expect(commit).toHaveBeenCalledTimes(1);expect(s.service.busy).toBe(true);
    saved();expect(await result).toBe('rewarded');expect(s.service.busy).toBe(false);expect(s.off).toHaveBeenCalledTimes(1);expect(s.busy.mock.calls).toEqual([[true],[false]]);
    s.emit('rewarded');expect(commit).toHaveBeenCalledTimes(1);
  });
  it.each(['closed','failed'])('never grants on %s alone',async state=>{
    const s=setup(),commit=vi.fn(),result=s.service.request('piece_swap',commit);s.emit(state);
    expect(await result).toBe(state==='closed'?'cancelled':'unavailable');expect(commit).not.toHaveBeenCalled();expect(s.service.busy).toBe(false);
  });
  it('refuses double taps and parallel ads',async()=>{
    const s=setup(),first=s.service.request('piece_swap',()=>{});
    expect(await s.service.request('piece_swap',()=>{})).toBe('busy');expect(s.adapter.show).toHaveBeenCalledTimes(1);s.emit('closed');await first;
  });
  it('does not call the SDK when unsupported or blocked',async()=>{
    const s=setup();s.adapter.supported=()=>false;expect(await s.service.request('piece_swap',()=>{})).toBe('unavailable');
    s.adapter.blocked=()=>true;expect(await s.service.request('piece_swap',()=>{})).toBe('busy');expect(s.adapter.show).not.toHaveBeenCalled();
  });
  it('recovers from thrown SDK show and subscribe failures',async()=>{
    const s=setup();s.adapter.show.mockImplementationOnce(()=>{throw new Error('SDK');});
    expect(await s.service.request('piece_swap',()=>{})).toBe('failed');expect(s.service.busy).toBe(false);
    s.adapter.subscribe.mockImplementationOnce(()=>{throw new Error('events');});
    expect(await s.service.request('piece_swap',()=>{})).toBe('failed');expect(s.service.busy).toBe(false);
  });
  it('releases operation even if SDK unsubscription throws',async()=>{
    const s=setup();s.off.mockImplementation(()=>{throw new Error('cleanup');});
    const result=s.service.request('piece_swap',()=>{});s.emit('closed');expect(await result).toBe('cancelled');expect(s.service.busy).toBe(false);
  });
  it('times out loading, but never closes an opened video with the loading timer',async()=>{
    vi.useFakeTimers();const s=setup(),commit=vi.fn(),first=s.service.request('piece_swap',commit);
    await vi.advanceTimersByTimeAsync(MONETIZATION.loadTimeoutMs);expect(await first).toBe('unavailable');expect(commit).not.toHaveBeenCalled();
    const second=s.service.request('piece_swap',commit);s.emit('opened');await vi.advanceTimersByTimeAsync(MONETIZATION.loadTimeoutMs*2);
    expect(s.service.busy).toBe(true);s.emit('closed');expect(await second).toBe('cancelled');
  });
  it('handles a synchronous terminal event while subscribing without showing a new ad',async()=>{
    const s=setup();s.adapter.subscribe.mockImplementationOnce(next=>{next('failed');return s.off;});
    expect(await s.service.request('piece_swap',()=>{})).toBe('unavailable');expect(s.adapter.show).not.toHaveBeenCalled();expect(s.off).toHaveBeenCalledTimes(1);
  });
});
