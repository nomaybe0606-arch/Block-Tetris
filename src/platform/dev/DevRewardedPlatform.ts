import { MemoryPlatform } from '../PlatformService';
import { RewardedAdService } from '../RewardedAdService';

/** GRID_PULSE_DEV_REWARDED_ONLY: dynamically imported ONLY by localhost DEV boot. */
export class DevRewardedPlatform extends MemoryPlatform {
  private listener:((state:string)=>void)|null=null;
  private ads:RewardedAdService;
  constructor(private scenario:string){
    super();
    this.ads=new RewardedAdService({supported:()=>true,blocked:()=>false,
      subscribe:listener=>{this.listener=listener;return()=>{this.listener=null;};},
      show:()=>{
        if(this.scenario==='error')throw new Error('DEV SDK error');
        this.listener?.('loading');
        setTimeout(()=>{
          if(this.scenario==='no-fill'){this.listener?.('failed');return;}
          this.listener?.('opened');
          setTimeout(()=>{
            if(this.scenario!=='cancel'){this.listener?.('rewarded');if(this.scenario==='duplicate')this.listener?.('rewarded');}
            this.listener?.('closed');
          },400);
        },150);
      },
    },busy=>{this.paused=busy||document.hidden;this.onChange?.();});
  }
  override get rewardedSupported():boolean{return true;}
  override get adBusy():boolean{return this.ads.busy;}
  override showRewarded(onReward:()=>void|Promise<void>){return this.ads.request('piece_swap',onReward);}
}
