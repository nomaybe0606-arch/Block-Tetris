import './style.css';
import type { PlatformPort } from './platform/PlatformService';
import { defaultProfile, restoreProfile } from './platform/profile';
import { fitFrameWhileLoading } from './ui/frameFit';
import { loaderStage } from './ui/loader';

// Fit the loading screen at once: SDK init and the engine download can take seconds on a cold start.
const stopLoadingFit=fitFrameWhileLoading();
loaderStage(0.05,0.3);

// Each host build bundles only its own SDK: the VK build never loads Playgama Bridge and vice versa.
async function hostPlatform():Promise<PlatformPort>{
  if(import.meta.env.MODE==='vk'){const {VkPlatform}=await import('./platform/VkPlatform');const platform=new VkPlatform();await platform.initialize();return platform;}
  const {PlatformService}=await import('./platform/PlatformService');const platform=new PlatformService();await platform.initialize();return platform;
}
async function boot():Promise<void>{
  const query=new URLSearchParams(location.search);
  const explicitMock=import.meta.env.DEV&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&query.get('mock')==='1';
  let platform:PlatformPort;
  if(import.meta.env.DEV&&explicitMock&&query.has('rewarded')){
    const {DevRewardedPlatform}=await import('./platform/dev/DevRewardedPlatform');
    platform=new DevRewardedPlatform(query.get('rewarded')!);
  }else if(import.meta.env.DEV&&explicitMock){
    const {MemoryPlatform}=await import('./platform/MemoryPlatform');platform=new MemoryPlatform();
  }else platform=await hostPlatform();
  loaderStage(0.3,0.45);
  const defaults=defaultProfile(platform.language,matchMedia('(prefers-reduced-motion: reduce)').matches);
  const profile=restoreProfile(await platform.load(),defaults);
  if(import.meta.env.DEV&&explicitMock&&query.get('qa')==='tray'){
    const {prepareTrayFixture}=await import('./debug/trayFixture');prepareTrayFixture(profile);
  }
  if(import.meta.env.DEV&&explicitMock&&query.get('qa')==='combo'){
    const {prepareComboFixture}=await import('./debug/trayFixture');prepareComboFixture(profile,Number(query.get('combo'))||8);
  }
  // The engine download is the longest stage.
  loaderStage(0.45,0.92);
  // Start the engine only after Bridge initialization and restoration have completed.
  const {App}=await import('./App');new App(platform,profile);stopLoadingFit();
}
void boot().catch(error=>{
  console.error('Grid Tetris startup failed',error);
  const text=document.querySelector('#loading-text');if(text)text.textContent='Unable to start. Please reload the page. / Перезагрузите страницу.';
});
