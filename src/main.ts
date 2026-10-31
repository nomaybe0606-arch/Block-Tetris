import './style.css';
import { PlatformService, MemoryPlatform, type PlatformPort } from './platform/PlatformService';
import { defaultProfile, restoreProfile } from './platform/profile';

async function boot():Promise<void>{
  const explicitMock=import.meta.env.DEV&&new URLSearchParams(location.search).get('mock')==='1';
  const platform:PlatformPort=explicitMock?new MemoryPlatform():new PlatformService();
  if(platform instanceof PlatformService)await platform.initialize();
  const defaults=defaultProfile(platform.language,matchMedia('(prefers-reduced-motion: reduce)').matches);
  const profile=restoreProfile(await platform.load(),defaults);
  // Start the engine only after Bridge initialization and restoration have completed.
  const {App}=await import('./App');new App(platform,profile);
}
void boot().catch(error=>{
  console.error('Grid Pulse startup failed',error);
  const text=document.querySelector('#loading-text');if(text)text.textContent='Unable to start. Please reload the page. / Перезагрузите страницу.';
});
