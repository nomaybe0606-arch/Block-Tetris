import { MONETIZATION } from '../config/monetization';
import { generateSwapOffer } from '../core/SwapGenerator';
import { canSwap, cancelSwap, confirmSwapReward, prepareSwap, swapsRemaining } from '../core/SwapService';
import type { GameState, SwapOffer } from '../core/types';
import type { CopyKey } from '../localization/strings';
import type { PlatformPort } from '../platform/PlatformService';
import type { SwapUI } from './SwapModal';

export interface SwapHost {
  state():GameState;replace(state:GameState):void;checkpoint():Promise<boolean>;
  selected():number;select(slot:number):void;changed():void;animate(offer:SwapOffer):Promise<void>;
}
export class SwapController {
  busy=false;savePending=false;message:CopyKey|null=null;offer:SwapOffer|null=null;
  constructor(private platform:PlatformPort,private host:SwapHost){}
  open():void{
    if(this.busy||this.savePending)return;
    let slot=this.host.selected();if(!this.host.state().tray[slot])slot=this.host.state().tray.findIndex(Boolean);
    this.select(slot);
  }
  select(slot:number):void{
    if(this.busy||this.savePending||!this.host.state().tray[slot])return;
    this.host.select(slot);this.offer=generateSwapOffer(this.host.state(),slot);this.message=null;this.host.changed();
  }
  model(visible:boolean,translate:(key:CopyKey)=>string):SwapUI{
    return {supported:this.platform.rewardedSupported,visible,remaining:swapsRemaining(this.host.state()),offer:this.offer,selected:this.host.selected(),busy:this.busy,savePending:this.savePending,message:this.message?translate(this.message):''};
  }
  private async persist():Promise<boolean>{try{return await this.host.checkpoint();}catch{return false;}}
  async watch():Promise<void>{
    if(this.busy||this.savePending||!this.platform.rewardedSupported||!canSwap(this.host.state())||!this.offer)return;
    const prepared=prepareSwap(this.host.state(),this.offer);if(!prepared)return;
    this.busy=true;this.message=null;this.host.replace(prepared);this.host.changed();
    try{
      if(!await this.persist()){
        this.host.replace(cancelSwap(this.host.state()));this.message='saveRequired';return;
      }
      await this.requestRemaining(prepared.swapOperation!.id);
    }catch{
      this.host.replace(cancelSwap(this.host.state()));this.message='adUnavailable';await this.persist();
    }finally{this.busy=false;this.host.changed();}
  }
  private async requestRemaining(operationId:string):Promise<void>{
      const start=this.host.state().swapOperation?.rewardsConfirmed??0;
      for(let index=start;index<MONETIZATION.rewardedAdsPerSwap;index++){
        const result=await this.platform.showRewarded(async()=>{
          this.host.replace(confirmSwapReward(this.host.state(),operationId,index));
          this.savePending=!await this.persist();
          if(this.savePending)this.message='rewardSaveError';
        });
        if(result!=='rewarded'){
          this.host.replace(cancelSwap(this.host.state()));this.message=result==='cancelled'?'adCancelled':'adUnavailable';
          await this.persist();return;
        }
        if(this.savePending)return;
        if((this.host.state().swapOperation?.rewardsConfirmed??0)!==index+1){
          this.host.replace(cancelSwap(this.host.state()));this.message='adUnavailable';await this.persist();return;
        }
      }
      if(this.host.state().swapOperation?.status==='applied'&&this.offer)await this.host.animate(this.offer);
  }
  async retrySave():Promise<void>{
    if(!this.savePending||this.busy||!this.offer)return;
    this.busy=true;this.host.changed();
    try{
      if(await this.persist()){
        this.savePending=false;this.message=null;
        if(this.host.state().swapOperation?.status==='applied')await this.host.animate(this.offer);
        else if(this.host.state().swapOperation?.status==='pending')await this.requestRemaining(this.host.state().swapOperation!.id);
      }
    }catch{
      this.host.replace(cancelSwap(this.host.state()));this.message='adUnavailable';await this.persist();
    }finally{this.busy=false;this.host.changed();}
  }
}
