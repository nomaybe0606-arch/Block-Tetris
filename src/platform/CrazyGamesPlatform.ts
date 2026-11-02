import type { PlatformPort } from './PlatformService';
import type { RewardedResult } from './RewardedAdService';

export const CRAZYGAMES_SDK_URL='https://sdk.crazygames.com/crazygames-sdk-v3.js';
const KEY='grid-pulse-v1';
export interface CrazyGamesSDK {
  init():Promise<void>; readonly environment:'local'|'crazygames'|'disabled';
  user:{systemInfo?:{locale?:string}};
  game:{settings?:{muteAudio?:boolean};loadingStart():void;loadingStop():void;gameplayStart():void;gameplayStop():void;
    addSettingsChangeListener?(listener:(settings:{muteAudio?:boolean})=>void):void;
    removeSettingsChangeListener?(listener:(settings:{muteAudio?:boolean})=>void):void};
  data:{getItem(key:string):string|null;setItem(key:string,value:string):void};
}
declare global {interface Window {CrazyGames?:{SDK:CrazyGamesSDK}}}

function timeout<T>(work:Promise<T>,ms=5000):Promise<T>{
  let timer:ReturnType<typeof setTimeout>;
  return Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('SDK timeout')),ms);})]).finally(()=>clearTimeout(timer));
}
export async function loadCrazyGamesSDK():Promise<CrazyGamesSDK|null>{
  if(window.CrazyGames?.SDK)return window.CrazyGames.SDK;
  // Only this host imports the loader. A network failure must never strand the loading screen.
  const script=document.createElement('script');script.src=CRAZYGAMES_SDK_URL;script.async=true;
  try{
    await timeout(new Promise<void>((resolve,reject)=>{script.onload=()=>resolve();script.onerror=()=>reject(new Error('SDK unavailable'));document.head.append(script);}));
    return window.CrazyGames?.SDK??null;
  }catch{return null;}finally{script.onload=null;script.onerror=null;script.remove();}
}

/** Basic Launch deliberately has no ad implementation. A Full Launch adapter can use
 * the same PlatformPort rewarded boundary later, without changing the game rules. */
export class CrazyGamesPlatform implements PlatformPort {
  language='en';audioEnabled=true;paused=false;storageAvailable=false;onChange:(()=>void)|null=null;
  readonly rewardedSupported=false;readonly adBusy=false;
  private sdk:CrazyGamesSDK|null=null;private ready=false;private wanted=false;private playing=false;private writable=false;private disposed=false;
  constructor(private loader:()=>Promise<CrazyGamesSDK|null>=loadCrazyGamesSDK){}
  async initialize():Promise<void>{
    try{
      const sdk=await timeout(this.loader());if(!sdk)return;
      // environment is usable after init; no game/user/data calls in disabled mode.
      await timeout(sdk.init());if(this.disposed||!['local','crazygames'].includes(sdk.environment))return;
      this.sdk=sdk;this.language=sdk.user.systemInfo?.locale?.toLowerCase().startsWith('ru')?'ru':'en';
      this.audioEnabled=!sdk.game.settings?.muteAudio;
      sdk.game.addSettingsChangeListener?.(this.settingsChanged);sdk.game.loadingStart();
    }catch{this.sdk=null;}finally{if(!this.disposed){document.addEventListener('visibilitychange',this.visibilityChanged);this.visibilityChanged();}}
  }
  private settingsChanged=(settings:{muteAudio?:boolean}):void=>{this.audioEnabled=!settings.muteAudio;this.onChange?.();};
  private visibilityChanged=():void=>{this.paused=document.hidden;this.onChange?.();};
  async load():Promise<unknown>{
    if(!this.sdk)return null;
    try{const value=this.sdk.data.getItem(KEY);this.writable=true;this.storageAvailable=true;return value;}
    catch{this.storageAvailable=false;return null;}
  }
  async save(data:string):Promise<boolean>{
    if(!this.sdk||!this.writable)return false;
    const before=this.storageAvailable;
    try{this.sdk.data.setItem(KEY,data);this.storageAvailable=true;}catch{this.storageAvailable=false;}
    if(before!==this.storageAvailable)this.onChange?.();return this.storageAvailable;
  }
  checkpoint(data:string):Promise<boolean>{return this.save(data);}
  async showRewarded(_onReward:()=>void|Promise<void>):Promise<RewardedResult>{return 'unavailable';}
  gameplayAction():void{}
  message(message:string):void{
    if(message!=='game_ready'||this.ready)return;this.ready=true;
    try{this.sdk?.game.loadingStop();}catch{/* A host event failure does not stop the round. */}
    this.syncGameplay();
  }
  setGameplayActive(active:boolean):void{this.wanted=active;this.syncGameplay();}
  private syncGameplay():void{
    const next=this.ready&&this.wanted;if(!this.sdk||next===this.playing)return;
    try{if(next)this.sdk.game.gameplayStart();else this.sdk.game.gameplayStop();this.playing=next;}catch{/* Retry on the next screen change. */}
  }
  gameOver():void{this.setGameplayActive(false);}
  destroy():void{
    this.setGameplayActive(false);this.disposed=true;document.removeEventListener('visibilitychange',this.visibilityChanged);
    try{this.sdk?.game.removeSettingsChangeListener?.(this.settingsChanged);}catch{/* Best effort cleanup. */}
    this.sdk=null;this.onChange=null;
  }
}
