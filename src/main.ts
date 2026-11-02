import './style.css';
import { PlatformService, MemoryPlatform, type PlatformPort } from './platform/PlatformService';
import { defaultProfile, restoreProfile } from './platform/profile';

async function boot():Promise<void>{
  const query=new URLSearchParams(location.search);
  const explicitMock=import.meta.env.DEV&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&query.get('mock')==='1';
  let platform:PlatformPort=explicitMock?new MemoryPlatform():new PlatformService();
  if(import.meta.env.DEV&&explicitMock&&query.has('rewarded')){
    const {DevRewardedPlatform}=await import('./platform/dev/DevRewardedPlatform');
    platform=new DevRewardedPlatform(query.get('rewarded')!);
  }
  if(platform instanceof PlatformService)await platform.initialize();
  const defaults=defaultProfile(platform.language,matchMedia('(prefers-reduced-motion: reduce)').matches);
  const profile=restoreProfile(await platform.load(),defaults);
  if(import.meta.env.DEV&&explicitMock&&query.get('qa')==='tray'){
    const {prepareTrayFixture}=await import('./debug/trayFixture');prepareTrayFixture(profile);
  }
  // Start the engine only after Bridge initialization and restoration have completed.
  const {App}=await import('./App');new App(platform,profile);
}
void boot().catch(error=>{
  console.error('Grid Tetris startup failed',error);
  const text=document.querySelector('#loading-text');if(text)text.textContent='Unable to start. Please reload the page. / Перезагрузите страницу.';
});
