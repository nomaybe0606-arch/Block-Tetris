import bridge from '@playgama/bridge';
import { RewardedAdService, type RewardedResult } from './RewardedAdService';
import { MONETIZATION } from '../config/monetization';

export interface PlatformPort {
  language: string; audioEnabled: boolean; paused: boolean;
  load(): Promise<unknown>; save(data: string): Promise<boolean>;
  message(message: string): void; gameOver(gameId?:string): void;
  onChange: (() => void) | null;
  storageAvailable: boolean;
  readonly rewardedSupported: boolean;
  readonly adBusy: boolean;
  checkpoint(data: string): Promise<boolean>;
  showRewarded(onReward:()=>void|Promise<void>):Promise<RewardedResult>;
  gameplayAction():void;
  /** Hosts with banner ads show one only where the player is not in a round. */
  setBanner?(visible:boolean):void;
  /** Shown in settings only on hosts that allow external support links. */
  readonly supportUrl?:string;
}

const KEY = 'grid-pulse-v1';
export class PlatformService implements PlatformPort {
  language = 'en'; audioEnabled = true; paused = false;
  storageAvailable = true;
  onChange: (() => void) | null = null;
  private hostPaused = false;
  private adPaused = false;
  private initialized = false;
  private pending: string | null = null;
  private writing = false;
  private idleWaiters:(()=>void)[]=[];
  private rewardedOpen=false;
  private lastGameOver:string|null=null;
  private afterRewarded=false;
  private rewarded=new RewardedAdService({
    supported:()=>this.initialized&&bridge.platform.id!=='mock'&&!(typeof location!=='undefined'&&location.hostname.endsWith('.github.io'))&&bridge.advertisement.isRewardedSupported,
    blocked:()=>this.adPaused||this.hostPaused||this.rewardedOpen||bridge.advertisement.rewardedState==='loading'||bridge.advertisement.interstitialState==='loading',
    show:placement=>bridge.advertisement.showRewarded(placement),
    subscribe:listener=>{
      bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED,listener);
      return ()=>{bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED,listener);};
    },
  },()=>this.update());
  get rewardedSupported():boolean{return this.rewarded.supported;}
  get adBusy():boolean{return this.rewarded.busy||this.adPaused||this.rewardedOpen;}

  async initialize(): Promise<void> {
    try {
      await bridge.initialize();
      this.initialized = true;
      this.language = bridge.platform.language || 'en';
      this.audioEnabled = bridge.platform.isAudioEnabled;
      this.hostPaused = bridge.platform.isPaused;
      this.adPaused = bridge.advertisement.interstitialState === 'opened';
      this.rewardedOpen = bridge.advertisement.rewardedState === 'opened';
      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (value: boolean) => { this.audioEnabled = value; this.update(); });
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (value: boolean) => { this.hostPaused = value; this.update(); });
      bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (value: string) => { this.adPaused = value === 'opened'; this.update(); });
      bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED,(value:string)=>{this.rewardedOpen=value==='opened';this.update();});
    } catch (error) {
      this.storageAvailable = false;
      console.warn('Bridge initialization failed. Progress is available only in this session.', error);
    }
    document.addEventListener('visibilitychange', () => this.update());
    this.update();
  }
  private update(): void {
    this.paused = this.hostPaused || this.adPaused || this.rewardedOpen || this.rewarded.busy || document.hidden;
    this.onChange?.();
  }
  async load(): Promise<unknown> {
    if (!this.initialized) return null;
    try { const data = await bridge.storage.get([KEY]); return Array.isArray(data) ? data[0] : null; }
    catch (error) { this.storageAvailable = false; console.warn('Bridge load failed', error); return null; }
  }
  async save(data: string): Promise<boolean> {
    if (!this.initialized) return false;
    this.pending = data;
    if (this.writing) return this.storageAvailable;
    this.writing = true;
    try {
      while (this.pending !== null) {
        const snapshot = this.pending;
        this.pending = null;
        const wasAvailable = this.storageAvailable;
        try { await bridge.storage.set([KEY], [snapshot]); this.storageAvailable = true; }
        catch (error) { this.storageAvailable = false; console.warn('Bridge save failed', error); }
        if (wasAvailable !== this.storageAvailable) this.onChange?.();
      }
    } finally { this.writing = false;for(const done of this.idleWaiters.splice(0))done(); }
    return this.storageAvailable;
  }
  async checkpoint(data:string):Promise<boolean>{
    if(!this.initialized)return false;
    await this.save(data);
    if(this.writing)await new Promise<void>(resolve=>this.idleWaiters.push(resolve));
    return this.storageAvailable;
  }
  showRewarded(onReward:()=>void|Promise<void>):Promise<RewardedResult>{
    this.afterRewarded=true;return this.rewarded.request(MONETIZATION.placement,onReward);
  }
  gameplayAction():void{this.afterRewarded=false;}
  message(message: string): void {
    if (!this.initialized) return;
    void Promise.resolve(bridge.platform.sendMessage(message)).catch(error => console.warn('Bridge message failed', error));
  }
  gameOver(gameId='legacy'): void {
    if(this.lastGameOver===gameId)return;this.lastGameOver=gameId;
    this.message('level_failed');
    if (!this.initialized || this.adBusy || this.afterRewarded || !bridge.advertisement.isInterstitialSupported) return;
    try { bridge.advertisement.showInterstitial('game_over'); }
    catch (error) { console.warn('Interstitial unavailable', error); }
  }
}

export { MemoryPlatform } from './MemoryPlatform';
