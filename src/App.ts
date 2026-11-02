import Phaser from 'phaser';
import { VIEW } from './config/layout';
import { newGame, placePiece, tutorialGame } from './core/game';
import type { GameState, Placement } from './core/types';
import type { PlatformPort } from './platform/PlatformService';
import type { Profile, Settings } from './platform/profile';
import { AudioService } from './audio/AudioService';
import { GameScene, type SceneDelegate } from './scenes/GameScene';
import { Interface, type Modal, type Screen } from './ui/Interface';
import { fitFrame } from './ui/frameFit';
import { hideLoader } from './ui/loader';
import { SwapController } from './ui/SwapController';
import { strings } from './localization/strings';
import { MONETIZATION } from './config/monetization';
import type { ClearEvent } from './rendering/ClearEvent';
import { bufferRatio, ENGINE_INPUT, RENDER } from './rendering/renderConfig';

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
export class App implements SceneDelegate {
  state: GameState;
  private screen:Screen='menu';
  private modal:Modal=null;
  private scene!:GameScene;
  private ui:Interface;
  private audio:AudioService;
  private game:Phaser.Game;
  private training=false;
  private tutorialReturn:Screen='menu';
  private beforeRestart:Modal=null;
  private lastPaused=false;
  private recordTarget=0;
  private recordAnnounced=false;
  private swap:SwapController;
  private closing=false;
  private displayScale=1;private renderRatio=1;private viewportKey='';
  constructor(private platform:PlatformPort,private profile:Profile) {
    this.state=profile.game??newGame(seed(),profile.best);
    this.ui=new Interface(action=>this.action(action),(key,value)=>this.setting(key,value));
    this.audio=new AudioService(profile.settings);
    this.swap=new SwapController(platform,{
      state:()=>this.state,replace:state=>{this.state=state;this.profile.game=state;},
      checkpoint:()=>this.platform.checkpoint(JSON.stringify(this.profile)),
      selected:()=>this.profile.selectedSwapSlot,select:slot=>{if(this.profile.selectedSwapSlot!==slot){this.profile.selectedSwapSlot=slot;this.save();}},changed:()=>this.render(),
      animate:async offer=>{this.modal=null;this.render();this.audio.play('combo');await this.scene.animateSwap(offer);this.scene.refresh();},
    });
    this.platform.onChange=()=>this.platformChanged();
    this.resize();this.renderRatio=bufferRatio(this.displayScale,window.devicePixelRatio||1);
    this.game=new Phaser.Game({
      type:Phaser.AUTO,parent:'game',width:VIEW.width*this.pixelRatio(),height:VIEW.height*this.pixelRatio(),transparent:true,
      render:RENDER,
      input:ENGINE_INPUT,
      audio:{noAudio:true},fps:{target:60,smoothStep:false},scene:[new GameScene(this)],
      scale:{mode:Phaser.Scale.NONE,width:VIEW.width*this.pixelRatio(),height:VIEW.height*this.pixelRatio()},
    });
    this.game.canvas.tabIndex=0;
    window.addEventListener('resize',this.resize);window.visualViewport?.addEventListener('resize',this.resize);
    window.addEventListener('pagehide',()=>this.save());
    window.addEventListener('blur',()=>this.scene?.cancel());
    document.addEventListener('contextmenu',e=>{if((e.target as Element).closest('#frame'))e.preventDefault();});
    this.resize();
  }
  onReady(scene:GameScene):void {
    this.scene=scene;scene.show(false);this.render();
    // The host learns the game is ready once the loading screen has actually faded out.
    void hideLoader().then(()=>this.platform.message('game_ready'));this.platformChanged();
  }
  reducedMotion():boolean{return this.profile.settings.reducedMotion;}
  intenseEffects():boolean{return this.profile.settings.intenseEffects;}
  showSwapControl():boolean{return !this.training&&this.platform.rewardedSupported&&this.state.moves>=MONETIZATION.swapUnlockAfterPlacedPieces;}
  pixelRatio():number{return this.renderRatio;}
  isTutorial():boolean{return this.training;}
  canInteract():boolean{return (this.screen==='game'||this.screen==='tutorial')&&!this.modal&&!this.platform.paused&&!this.swap.busy&&!this.swap.savePending&&!this.state.over;}
  onPick():void{this.audio.play('pick');}
  audioStats():{audioBuffers:number;audioVoices:number}{return this.audio.stats;}
  language():'en'|'ru'{return this.profile.settings.language;}
  onPlace(slot:number,x:number,y:number):Placement|null{
    if(!this.canInteract())return null;
    const result=placePiece(this.state,slot,x,y);if(!result)return null;
    this.platform.gameplayAction();
    this.state=result.state;
    if(!this.training){
      this.profile.best=Math.max(this.profile.best,this.state.best);this.profile.maxCombo=Math.max(this.profile.maxCombo,this.state.maxCombo);
      this.profile.totalLines+=result.rows.length+result.columns.length;this.profile.game=this.state;this.save();
    }
    this.audio.play('place');
    if(!this.training&&!this.recordAnnounced&&this.state.score>this.recordTarget){this.recordAnnounced=true;this.audio.play('record');this.scene.record();this.ui.record(this.reducedMotion()||!this.intenseEffects());}
    this.render(true);return result;
  }
  onClearFeedback(event:ClearEvent):void{
    this.audio.play(event.combo>1||event.rows.length+event.columns.length>1?'combo':'clear');
  }
  onSettled():void{
    if(this.training&&this.state.lines>0){this.modal='tutorial-success';this.render();}
    else if(this.state.over){this.modal='over';this.audio.setActive(false);this.render();this.platform.gameOver(this.state.id);}
  }
  private resize=():void=>{
    const {key,scale}=fitFrame();if(key===this.viewportKey)return;this.viewportKey=key;
    this.displayScale=scale;this.scene?.cancel();
  };
  private platformChanged():void{
    this.audio.setBlocked(!this.platform.audioEnabled||this.platform.paused);
    if(!this.scene)return;
    if(this.platform.paused){this.scene.cancel();this.scene.tweens.pauseAll();this.scene.time.paused=true;if(!this.lastPaused)this.save();}
    else{this.scene.tweens.resumeAll();this.scene.time.paused=false;}
    this.lastPaused=this.platform.paused;
    // Keep the engine's visibility sleep behavior; update only the independent audio/DOM state here.
    this.render();
  }
  private setting(key:string,value:boolean|string):void{
    const settings=this.profile.settings;
    if(key==='language'&&(value==='en'||value==='ru'))settings.language=value;
    else if(['sound','music','mute','reducedMotion','intenseEffects'].includes(key)&&typeof value==='boolean')settings[key as Exclude<keyof Settings,'language'>]=value;
    this.audio.configure(settings);this.audio.play('ui');this.save();this.render();
  }
  private action(action:string):void{
    if(this.platform.paused||this.closing)return;
    if((this.swap.busy||this.swap.savePending)&&action!=='swap-retry')return;
    if(action==='swap-retry'){void this.swap.retrySave();return;}
    if(action==='swap-watch'){if(this.modal==='swap')void this.swap.watch();return;}
    if(action.startsWith('swap-select-')){if(this.modal==='swap')this.swap.select(Number(action.slice(-1)));return;}
    if(action==='swap'){
      if(!this.canInteract()||this.scene.isDragging()||!this.showSwapControl())return;
      this.modal='swap';this.swap.open();this.render();return;
    }
    if(action==='close'){
      this.closing=true;this.ui.closeDialog(this.reducedMotion(),()=>{
        this.closing=false;this.modal=this.modal==='restart'?this.beforeRestart:null;
        if(!this.modal&&this.screen==='game')this.platform.message('level_resumed');this.render();
      });return;
    }
    this.audio.play('ui');
    if(action==='settings'){this.scene.cancel();this.modal='settings';if(this.screen==='game')this.platform.message('level_paused');}
    else if(action==='play'){
      if(!this.profile.tutorialDone&&!this.profile.game){this.startTutorial();return;}
      this.startGame(false);return;
    }else if(action==='new'){
      this.beforeRestart=this.modal;
      if(this.profile.game&&!this.profile.game.over)this.modal='restart';else{this.startGame(true);return;}
    }else if(action==='confirm-new'){this.startGame(true);return;}
    else if(action==='home'){
      this.scene.cancel();
      if(this.training){this.training=false;this.state=this.profile.game??newGame(seed(),this.profile.best);}
      if(this.screen==='game')this.platform.message('level_paused');
      this.screen='menu';this.modal=null;this.scene.show(false);this.audio.setActive(true);this.save();
    }else if(action==='tutorial'){this.startTutorial();return;}
    else if(action==='skip'||action==='finish-tutorial'){
      this.profile.tutorialDone=true;this.training=false;this.modal=null;
      if(this.tutorialReturn==='game'||!this.profile.game){this.startGame(false);return;}
      this.state=this.profile.game;this.screen='menu';this.scene.show(false);this.save();
    }
    this.render();
  }
  private startTutorial():void{
    this.tutorialReturn=this.screen;this.training=true;this.screen='tutorial';this.modal=null;
    this.state=tutorialGame(seed(),this.profile.best);this.scene.cancel();this.scene.show(true);this.scene.refresh(true);this.render();
  }
  private startGame(fresh:boolean):void{
    this.scene.cancel();this.training=false;this.screen='game';this.modal=null;
    this.state=!fresh&&this.profile.game&&!this.profile.game.over?this.profile.game:newGame(seed(),this.profile.best);
    this.recordTarget=this.profile.best;this.recordAnnounced=this.state.score>=this.recordTarget&&this.state.score>0;
    this.profile.game=this.state;this.scene.show(true);this.scene.refresh(true);this.audio.setActive(true);
    this.platform.message('level_started');this.save();this.render();
  }
  private save():void{void this.platform.save(JSON.stringify(this.profile));}
  private render(animateScore=false):void{
    const c=strings[this.profile.settings.language];
    this.ui.render({screen:this.screen,modal:this.modal,state:this.state,profile:this.profile,paused:this.platform.paused,storageAvailable:this.platform.storageAvailable,supportUrl:this.platform.supportUrl,swap:this.swap.model(this.showSwapControl()&&this.screen==='game',key=>c[key])},animateScore);
    this.platform.setBanner?.(this.screen==='menu');
    // CrazyGames tracks tab visibility itself; report actual menus/pauses, not focus loss.
    this.platform.setGameplayActive?.((this.screen==='game'||this.screen==='tutorial')&&!this.modal&&!this.swap.busy&&!this.swap.savePending&&!this.state.over);
    this.game?.canvas.setAttribute('aria-label',this.profile.settings.language==='ru'?'Поле 8 на 8. Фигуры: клавиши 1, 2, 3; стрелки; Enter.':'8 by 8 board. Select a piece with 1, 2, 3; move with arrows; place with Enter.');
  }
}
