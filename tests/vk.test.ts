import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fake=vi.hoisted(()=>({
  send:vi.fn(),subscribe:vi.fn(),isEmbedded:vi.fn(),
  store:new Map<string,string>(),listener:null as null|((event:{detail:{type:string}})=>void),
}));
vi.mock('@vkontakte/vk-bridge',()=>({default:fake}));
import { VkPlatform, VK } from '../src/platform/VkPlatform';
import { VkStorage, splitChunks, VK_CHUNK_BYTES, type KeyValueApi } from '../src/platform/vkStorage';
import { newGame } from '../src/core/game';
import { defaultProfile } from '../src/platform/profile';

const memoryApi=(store=new Map<string,string>()):KeyValueApi&{store:Map<string,string>}=>({store,
  get:async keys=>Object.fromEntries(keys.map(key=>[key,store.get(key)??''])),
  set:async(key,value)=>{store.set(key,value);},
});
const responses:Record<string,(params:Record<string,unknown>)=>unknown>={};
const ads={reward:true,interstitial:true,rewardShown:true};

beforeEach(()=>{
  vi.resetAllMocks();fake.store.clear();fake.listener=null;
  Object.assign(ads,{reward:true,interstitial:true,rewardShown:true});
  for(const key of Object.keys(responses))delete responses[key];
  fake.isEmbedded.mockReturnValue(true);
  fake.subscribe.mockImplementation(listener=>{fake.listener=listener;});
  fake.send.mockImplementation(async(method:string,params:Record<string,unknown>={})=>{
    if(responses[method])return responses[method](params);
    if(method==='VKWebAppInit')return {result:true};
    if(method==='VKWebAppStorageGet')return {keys:(params.keys as string[]).map(key=>({key,value:fake.store.get(key)??''}))};
    if(method==='VKWebAppStorageSet'){fake.store.set(params.key as string,params.value as string);return {result:true};}
    if(method==='VKWebAppCheckNativeAds')return {result:ads[params.ad_format as 'reward'|'interstitial']};
    if(method==='VKWebAppShowNativeAds')return {result:params.ad_format==='reward'?ads.rewardShown:true};
    if(method==='VKWebAppShowBannerAd')return {result:true};
    return {result:true};
  });
  vi.stubGlobal('location',{search:'?vk_language=ru&vk_platform=mobile_android'});
  vi.stubGlobal('navigator',{language:'en-US'});
  vi.stubGlobal('document',{hidden:false,addEventListener:vi.fn()});
  vi.stubGlobal('window',{addEventListener:vi.fn()});
  vi.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>{vi.useRealTimers();});
const sent=(method:string)=>fake.send.mock.calls.filter(([name])=>name===method);
async function ready():Promise<VkPlatform>{const p=new VkPlatform();await p.initialize();await p.load();return p;}

describe('VK storage',()=>{
  it('splits by UTF-8 bytes without breaking characters',()=>{
    const text='я'.repeat(VK_CHUNK_BYTES);const chunks=splitChunks(text);
    expect(chunks.join('')).toBe(text);
    for(const chunk of chunks)expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(VK_CHUNK_BYTES);
    expect(splitChunks('')).toEqual(['']);
  });
  it('round-trips large values and switches slots only after all chunks are written',async()=>{
    const api=memoryApi(),storage=new VkStorage(api,'save');
    expect(await storage.read()).toBeNull();
    const big='x'.repeat(VK_CHUNK_BYTES*2+10);await storage.write(big);
    expect(api.store.get('save')).toBe('a.3');
    await storage.write('small');expect(api.store.get('save')).toBe('b.1');
    expect(await new VkStorage(api,'save').read()).toBe('small');
  });
  it('keeps the previous complete copy when a save is interrupted',async()=>{
    const api=memoryApi(),storage=new VkStorage(api,'save');await storage.write('first');
    const set=api.set;let calls=0;
    api.set=async(key,value)=>{if(++calls===2)throw new Error('rate limit');await set(key,value);};
    await expect(storage.write('y'.repeat(VK_CHUNK_BYTES+1))).rejects.toThrow();
    expect(await new VkStorage(api,'save').read()).toBe('first');
  });
  it('rejects a broken chunk list instead of returning a partial save',async()=>{
    const api=memoryApi(new Map([['save','a.2'],['save_a0','{"half":']]));
    await expect(new VkStorage(api,'save').read()).rejects.toThrow();
  });
  it('fits a real game profile in one or two chunks',()=>{
    const profile=defaultProfile('ru',false);profile.game=newGame(7,1000);
    expect(splitChunks(JSON.stringify(profile)).length).toBeLessThanOrEqual(2);
  });
});

describe('VK platform',()=>{
  it('initializes VK, takes the VK language and restores the cloud save',async()=>{
    fake.store.set(VK.storageKey,'a.1');fake.store.set(`${VK.storageKey}_a0`,'{"saved":true}');
    const p=new VkPlatform();await p.initialize();
    expect(fake.send).toHaveBeenCalledWith('VKWebAppInit');expect(p.language).toBe('ru');
    expect(await p.load()).toBe('{"saved":true}');expect(p.rewardedSupported).toBe(true);expect(p.supportUrl).toMatch(/^https:\/\/vk\.com\//);
  });
  it('works without saving when opened outside VK',async()=>{
    fake.isEmbedded.mockReturnValue(false);const p=new VkPlatform();await p.initialize();
    expect(p.storageAvailable).toBe(false);expect(await p.load()).toBeNull();expect(await p.save('x')).toBe(false);
    expect(p.rewardedSupported).toBe(false);expect(fake.send).not.toHaveBeenCalled();
  });
  it('never overwrites cloud progress after a failed load',async()=>{
    responses.VKWebAppStorageGet=()=>{throw new Error('network');};
    const p=new VkPlatform();await p.initialize();expect(await p.load()).toBeNull();
    expect(await p.checkpoint('fresh')).toBe(false);expect(sent('VKWebAppStorageSet')).toHaveLength(0);
  });
  it('batches frequent saves and writes only the latest snapshot',async()=>{
    vi.useFakeTimers();const p=await ready();
    for(let move=0;move<20;move++)await p.save(`move-${move}`);
    expect(sent('VKWebAppStorageSet')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(VK.saveDelayMs);
    expect(sent('VKWebAppStorageSet')).toHaveLength(2);
    expect(fake.store.get(`${VK.storageKey}_a0`)).toBe('move-19');
  });
  it('writes immediately at a checkpoint and when VK hides the app',async()=>{
    const p=await ready();expect(await p.checkpoint('reward')).toBe(true);expect(fake.store.get(`${VK.storageKey}_a0`)).toBe('reward');
    await p.save('before-hide');fake.listener!({detail:{type:'VKWebAppViewHide'}});
    await vi.waitFor(()=>expect(fake.store.get(`${VK.storageKey}_b0`)).toBe('before-hide'));
    expect(p.paused).toBe(true);fake.listener!({detail:{type:'VKWebAppViewRestore'}});expect(p.paused).toBe(false);
  });
  it('reports a failed save and retries it with the next write',async()=>{
    const p=await ready();responses.VKWebAppStorageSet=()=>{throw new Error('limit');};
    expect(await p.checkpoint('a')).toBe(false);expect(p.storageAvailable).toBe(false);
    delete responses.VKWebAppStorageSet;expect(await p.checkpoint('b')).toBe(true);expect(fake.store.get(`${VK.storageKey}_a0`)).toBe('b');
  });
  it('grants the reward only for a fully watched rewarded video',async()=>{
    const p=await ready(),reward=vi.fn();
    expect(await p.showRewarded(reward)).toBe('rewarded');expect(reward).toHaveBeenCalledTimes(1);
    ads.rewardShown=false;const skipped=vi.fn();
    expect(await p.showRewarded(skipped)).toBe('cancelled');expect(skipped).not.toHaveBeenCalled();
    ads.reward=false;expect(await p.showRewarded(skipped)).toBe('unavailable');expect(skipped).not.toHaveBeenCalled();
    expect(p.paused).toBe(false);expect(p.adBusy).toBe(false);
  });
  it('pauses the game while a rewarded video is open',async()=>{
    let finish!:(value:{result:boolean})=>void;const p=await ready();
    responses.VKWebAppShowNativeAds=()=>new Promise(resolve=>{finish=resolve;});
    const result=p.showRewarded(()=>{});
    await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));expect(p.paused).toBe(true);
    finish({result:true});expect(await result).toBe('rewarded');expect(p.paused).toBe(false);
  });
  it('shows an interstitial at most once per game over and once a minute',async()=>{
    vi.useFakeTimers();const p=await ready();const shows=()=>sent('VKWebAppShowNativeAds').filter(([,params])=>params.ad_format==='interstitial').length;
    p.gameOver('early');expect(shows()).toBe(0);
    vi.setSystemTime(Date.now()+VK.interstitialGapMs);
    p.gameOver('one');p.gameOver('one');await vi.advanceTimersByTimeAsync(0);expect(shows()).toBe(1);
    p.gameOver('two');expect(shows()).toBe(1);
  });
  it('skips the interstitial right after a rewarded swap',async()=>{
    vi.useFakeTimers();const p=await ready();vi.setSystemTime(Date.now()+VK.interstitialGapMs);
    await p.showRewarded(()=>{});p.gameOver('after-swap');await vi.advanceTimersByTimeAsync(0);
    expect(sent('VKWebAppShowNativeAds').filter(([,params])=>params.ad_format==='interstitial')).toHaveLength(0);
  });
  it('shows the banner once, hides it on demand and respects a user close',async()=>{
    const p=await ready();
    p.setBanner(true);p.setBanner(true);await vi.waitFor(()=>expect(sent('VKWebAppShowBannerAd')).toHaveLength(1));
    p.setBanner(false);await vi.waitFor(()=>expect(sent('VKWebAppHideBannerAd')).toHaveLength(1));
    p.setBanner(true);await vi.waitFor(()=>expect(sent('VKWebAppShowBannerAd')).toHaveLength(2));
    fake.listener!({detail:{type:'VKWebAppBannerAdClosedByUser'}});p.setBanner(false);p.setBanner(true);
    await new Promise(resolve=>setTimeout(resolve,0));expect(sent('VKWebAppShowBannerAd')).toHaveLength(2);
  });
});
