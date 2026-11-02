import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {Window} from 'happy-dom';
import {CrazyGamesPlatform,loadCrazyGamesSDK,type CrazyGamesSDK} from '../src/platform/CrazyGamesPlatform';
let dom:Window;const instances:CrazyGamesPlatform[]=[];
beforeEach(()=>{dom=new Window();vi.stubGlobal('window',dom);vi.stubGlobal('document',dom.document);});
afterEach(()=>{for(const p of instances.splice(0))p.destroy();dom.close();vi.useRealTimers();vi.unstubAllGlobals();});
function setup(locale='en-US',environment:CrazyGamesSDK['environment']='local'){
  const sdk:CrazyGamesSDK={init:vi.fn(async()=>{}),environment,user:{systemInfo:{locale}},game:{settings:{muteAudio:false},loadingStart:vi.fn(),loadingStop:vi.fn(),gameplayStart:vi.fn(),gameplayStop:vi.fn(),addSettingsChangeListener:vi.fn(),removeSettingsChangeListener:vi.fn()},data:{getItem:vi.fn(()=>null),setItem:vi.fn()}};
  const platform=new CrazyGamesPlatform(async()=>sdk);instances.push(platform);return {platform,sdk};
}
describe('CrazyGames Basic Launch boundary',()=>{
  it.each([['ru-RU','ru'],['RU','ru'],['en-US','en'],['de-DE','en'],['','en']])('uses locale %s with English fallback',async(locale,expected)=>{const {platform}=setup(locale);await platform.initialize();expect(platform.language).toBe(expected);});
  it('waits for async SDK initialization before touching its modules',async()=>{
    const {platform,sdk}=setup();let finish!:()=>void;const deferred=new Promise<void>(resolve=>{finish=resolve;});vi.mocked(sdk.init).mockReturnValue(deferred);
    const init=platform.initialize();await vi.waitFor(()=>expect(sdk.init).toHaveBeenCalledOnce());expect(sdk.game.loadingStart).not.toHaveBeenCalled();finish();await init;expect(sdk.game.loadingStart).toHaveBeenCalledOnce();
  });
  it('does not call game, user or data modules in disabled environments',async()=>{
    const {platform,sdk}=setup('ru','disabled');for(const key of ['game','user','data'])Object.defineProperty(sdk,key,{get:()=>{throw new Error('Disabled module touched');}});
    await platform.initialize();platform.message('game_ready');platform.setGameplayActive(true);platform.gameOver();expect(await platform.load()).toBeNull();expect(await platform.save('new')).toBe(false);expect(platform.language).toBe('en');expect(platform.rewardedSupported).toBe(false);
  });
  it('starts only when both the loader and playable state are ready, with deduplicated pause/resume/over',async()=>{
    const {platform,sdk}=setup();await platform.initialize();platform.setGameplayActive(true);expect(sdk.game.gameplayStart).not.toHaveBeenCalled();
    platform.message('game_ready');platform.message('game_ready');expect(sdk.game.loadingStop).toHaveBeenCalledOnce();expect(sdk.game.gameplayStart).toHaveBeenCalledOnce();
    platform.setGameplayActive(true);platform.setGameplayActive(false);platform.setGameplayActive(false);expect(sdk.game.gameplayStop).toHaveBeenCalledOnce();
    platform.setGameplayActive(true);expect(sdk.game.gameplayStart).toHaveBeenCalledTimes(2);platform.gameOver();expect(sdk.game.gameplayStop).toHaveBeenCalledTimes(2);
  });
  it('does not report a menu as gameplay when the loader finishes',async()=>{const {platform,sdk}=setup();await platform.initialize();platform.message('game_ready');expect(sdk.game.gameplayStart).not.toHaveBeenCalled();});
  it('never rewards or requests ads, including repeated calls and game overs',async()=>{
    const {platform,sdk}=setup();Object.assign(sdk,{ad:{requestAd:vi.fn()}});await platform.initialize();const reward=vi.fn();for(let i=0;i<100;i++){expect(await platform.showRewarded(reward)).toBe('unavailable');platform.gameOver();}
    expect(reward).not.toHaveBeenCalled();expect((sdk as unknown as {ad:{requestAd:ReturnType<typeof vi.fn>}}).ad.requestAd).not.toHaveBeenCalled();expect(platform.rewardedSupported).toBe(false);expect(platform.adBusy).toBe(false);
  });
  it('keeps the old save key, reads before writing and permits retry after a failed save',async()=>{
    const {platform,sdk}=setup();await platform.initialize();expect(await platform.save('early')).toBe(false);vi.mocked(sdk.data.getItem).mockReturnValue('old');expect(await platform.load()).toBe('old');expect(sdk.data.getItem).toHaveBeenCalledWith('grid-pulse-v1');
    vi.mocked(sdk.data.setItem).mockImplementationOnce(()=>{throw Error('full');});expect(await platform.checkpoint('new')).toBe(false);expect(await platform.checkpoint('new')).toBe(true);expect(sdk.data.setItem).toHaveBeenLastCalledWith('grid-pulse-v1','new');
  });
  it('never overwrites unread progress after a load error',async()=>{const {platform,sdk}=setup();await platform.initialize();vi.mocked(sdk.data.getItem).mockImplementation(()=>{throw Error('read failed');});await platform.load();expect(await platform.save('blank')).toBe(false);expect(sdk.data.setItem).not.toHaveBeenCalled();});
  it('honors host mute changes and removes its listener',async()=>{
    const {platform,sdk}=setup();sdk.game.settings={muteAudio:true};await platform.initialize();expect(platform.audioEnabled).toBe(false);const listener=vi.mocked(sdk.game.addSettingsChangeListener!).mock.calls[0][0];platform.onChange=vi.fn();listener({muteAudio:false});expect(platform.audioEnabled).toBe(true);expect(platform.onChange).toHaveBeenCalled();platform.destroy();expect(sdk.game.removeSettingsChangeListener).toHaveBeenCalledWith(listener);
  });
  it.each(['missing','rejected'] as const)('plays safely when SDK is %s',async mode=>{
    const p=new CrazyGamesPlatform(async()=>{if(mode==='rejected')throw Error('offline');return null;});instances.push(p);await p.initialize();p.setGameplayActive(true);p.message('game_ready');expect(p.language).toBe('en');expect(p.paused).toBe(false);expect(p.storageAvailable).toBe(false);expect(await p.showRewarded(vi.fn())).toBe('unavailable');
  });
  it('times out an SDK that never settles instead of blocking boot',async()=>{vi.useFakeTimers();const p=new CrazyGamesPlatform(()=>new Promise(()=>{}));instances.push(p);const init=p.initialize();await vi.advanceTimersByTimeAsync(5001);await init;expect(p.storageAvailable).toBe(false);});
  it('loads the official async SDK URL and removes failed loader elements',async()=>{const request=loadCrazyGamesSDK(),script=dom.document.querySelector('script')!;expect(script.src).toBe('https://sdk.crazygames.com/crazygames-sdk-v3.js');script.dispatchEvent(new dom.Event('error'));expect(await request).toBeNull();expect(dom.document.querySelector('script')).toBeNull();});
});
