import type { PlatformPort } from './PlatformService';
import type { RewardedResult } from './RewardedAdService';

/** Explicit development-only mock; intentionally has no disk persistence. */
export class MemoryPlatform implements PlatformPort {
  language = 'en'; audioEnabled = true; paused = false; storageAvailable = true;
  onChange: (() => void) | null = null;
  private data: string | null = null;
  constructor(){
    document.addEventListener('visibilitychange',()=>{this.paused=this.adBusy||document.hidden;this.onChange?.();});
  }
  get rewardedSupported():boolean{return false;}
  get adBusy():boolean{return false;}
  async checkpoint(data:string):Promise<boolean>{return this.save(data);}
  async showRewarded(_onReward:()=>void|Promise<void>):Promise<RewardedResult>{return 'unavailable';}
  gameplayAction():void{}
  async load(): Promise<unknown> { return this.data; }
  async save(data: string): Promise<boolean> { this.data = data; return true; }
  message(_message: string): void { /* No host in explicit local mock mode. */ }
  gameOver(): void { /* No ads in local mock mode. */ }
}
