import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake=vi.hoisted(()=>({
  initialize:vi.fn(),storage:{get:vi.fn(),set:vi.fn()},
  platform:{language:'ru',isAudioEnabled:true,isPaused:false,sendMessage:vi.fn(),on:vi.fn()},
  advertisement:{interstitialState:'closed',isInterstitialSupported:true,showInterstitial:vi.fn(),on:vi.fn()},
  EVENT_NAME:{AUDIO_STATE_CHANGED:'audio',PAUSE_STATE_CHANGED:'pause',INTERSTITIAL_STATE_CHANGED:'ad'},
}));
vi.mock('@playgama/bridge',()=>({default:fake}));
import { MemoryPlatform, PlatformService } from '../src/platform/PlatformService';

beforeEach(()=>{
  vi.resetAllMocks();fake.initialize.mockResolvedValue(undefined);fake.storage.get.mockResolvedValue([null]);fake.storage.set.mockResolvedValue(undefined);fake.platform.sendMessage.mockResolvedValue(undefined);
  fake.platform.isAudioEnabled=true;fake.platform.isPaused=false;fake.advertisement.interstitialState='closed';fake.advertisement.isInterstitialSupported=true;
  vi.stubGlobal('document',{hidden:false,addEventListener:vi.fn()});vi.spyOn(console,'warn').mockImplementation(()=>{});
});
describe('Bridge integration boundary',()=>{
  it('initializes, loads and saves through Bridge only',async()=>{
    const p=new PlatformService();await p.initialize();expect(p.language).toBe('ru');
    fake.storage.get.mockResolvedValue(['saved']);expect(await p.load()).toBe('saved');await p.save('next');
    expect(fake.storage.get).toHaveBeenCalledWith(['grid-pulse-v1']);expect(fake.storage.set).toHaveBeenCalledWith(['grid-pulse-v1'],['next']);
  });
  it('survives initialization failure without calling storage',async()=>{
    fake.initialize.mockRejectedValue(new Error('offline'));const p=new PlatformService();await p.initialize();expect(p.storageAvailable).toBe(false);expect(await p.load()).toBeNull();expect(await p.save('x')).toBe(false);expect(fake.storage.set).not.toHaveBeenCalled();
  });
  it('survives load and save errors and recovers on the next write',async()=>{
    const p=new PlatformService();await p.initialize();fake.storage.get.mockRejectedValue(new Error('load'));expect(await p.load()).toBeNull();
    fake.storage.set.mockRejectedValueOnce(new Error('save'));expect(await p.save('a')).toBe(false);expect(await p.save('b')).toBe(true);
  });
  it('serializes writes and coalesces pending snapshots to prevent stale saves',async()=>{
    let finish!:()=>void;fake.storage.set.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
    const p=new PlatformService();await p.initialize();const first=p.save('first');await p.save('second');await p.save('latest');expect(fake.storage.set).toHaveBeenCalledTimes(1);finish();await first;
    expect(fake.storage.set).toHaveBeenCalledTimes(2);expect(fake.storage.set).toHaveBeenLastCalledWith(['grid-pulse-v1'],['latest']);
  });
  it('applies initial audio and pause states and subscribes to universal events',async()=>{
    fake.platform.isAudioEnabled=false;fake.platform.isPaused=true;const p=new PlatformService();await p.initialize();expect(p.audioEnabled).toBe(false);expect(p.paused).toBe(true);
    const listeners=new Map<string,(value:boolean)=>void>(fake.platform.on.mock.calls.map(([event,callback])=>[event,callback]));listeners.get('pause')!(false);expect(p.paused).toBe(false);listeners.get('audio')!(true);expect(p.audioEnabled).toBe(true);
    const ad=fake.advertisement.on.mock.calls[0][1];ad('opened');expect(p.paused).toBe(true);ad('closed');expect(p.paused).toBe(false);
  });
  it('uses ads only at the explicit game-over boundary and respects unsupported ads',async()=>{
    const p=new PlatformService();await p.initialize();p.message('game_ready');expect(fake.advertisement.showInterstitial).not.toHaveBeenCalled();p.gameOver();expect(fake.advertisement.showInterstitial).toHaveBeenCalledWith('game_over');
    fake.advertisement.isInterstitialSupported=false;p.gameOver();expect(fake.advertisement.showInterstitial).toHaveBeenCalledTimes(1);
  });
  it('handles an already-open interstitial during initialization',async()=>{
    fake.advertisement.interstitialState='opened';const p=new PlatformService();await p.initialize();expect(p.paused).toBe(true);
  });
  it('keeps explicit development mock data in memory only',async()=>{
    const a=new MemoryPlatform(),b=new MemoryPlatform();await a.save('state');expect(await a.load()).toBe('state');expect(await b.load()).toBeNull();expect(fake.storage.set).not.toHaveBeenCalled();
  });
});
