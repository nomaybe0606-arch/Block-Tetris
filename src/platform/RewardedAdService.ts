import { MONETIZATION } from '../config/monetization';
export type RewardedResult = 'rewarded' | 'cancelled' | 'unavailable' | 'failed' | 'busy';
export interface RewardedAdapter {
  supported(): boolean;
  blocked(): boolean;
  show(placement: string): void;
  subscribe(listener: (state: string) => void): () => void;
}
/** One SDK operation at a time. `closed` never grants a reward. */
export class RewardedAdService {
  private active: {rewarded:boolean;finishing:boolean;commit:Promise<void>;resolve:(result:RewardedResult)=>void;unsubscribe:()=>void;timer:ReturnType<typeof setTimeout>|null}|null=null;
  constructor(private adapter:RewardedAdapter,private onBusy:(busy:boolean)=>void){}
  get supported():boolean{return this.adapter.supported();}
  get busy():boolean{return this.active!==null;}
  request(placement:string,onReward:()=>void|Promise<void>):Promise<RewardedResult>{
    if(this.busy||this.adapter.blocked())return Promise.resolve('busy');
    if(!this.supported)return Promise.resolve('unavailable');
    return new Promise(resolve=>{
      const op={rewarded:false,finishing:false,commit:Promise.resolve(),resolve,unsubscribe:()=>{},timer:null as ReturnType<typeof setTimeout>|null};
      this.active=op;this.onBusy(true);
      const finish=(result:RewardedResult)=>{
        if(this.active!==op||op.finishing)return;
        op.finishing=true;if(op.timer)clearTimeout(op.timer);
        try{op.unsubscribe();}catch{ /* A broken SDK cleanup must still release the operation. */ }
        void op.commit.finally(()=>{if(this.active!==op)return;this.active=null;this.onBusy(false);resolve(op.rewarded?'rewarded':result);});
      };
      try{
      const unsubscribe=this.adapter.subscribe(state=>{
        if(this.active!==op||op.finishing)return;
        if(state==='opened'&&op.timer){clearTimeout(op.timer);op.timer=null;}
        if(state==='rewarded'&&!op.rewarded){
          op.rewarded=true;
          try{op.commit=Promise.resolve(onReward()).catch(()=>{});}catch{op.commit=Promise.resolve();}
        }
        if(state==='closed')finish('cancelled');
        if(state==='failed')finish('unavailable');
      });
      op.unsubscribe=unsubscribe;
      if(op.finishing){try{unsubscribe();}catch{}return;}
      op.timer=setTimeout(()=>finish('unavailable'),MONETIZATION.loadTimeoutMs);
      this.adapter.show(placement);
      }catch{finish('failed');}
    });
  }
}
