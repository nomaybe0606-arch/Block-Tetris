import Phaser from 'phaser';
import { VIEW } from './config/layout';
import { newGame, placePiece, tutorialGame } from './core/game';
import type { GameState, Placement } from './core/types';
import type { PlatformPort } from './platform/PlatformService';
import type { Profile, Settings } from './platform/profile';
import { AudioService } from './audio/AudioService';
import { GameScene, type SceneDelegate } from './scenes/GameScene';
import { Interface, type Modal, type Screen } from './ui/Interface';

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
export class App implements SceneDelegate {
  state: GameState;
  private screen:Screen='menu';
  private modal:Modal=null;
  private scene!:GameScene;
  private ui:Interface;
  private audio:AudioService;
  private game:Phaser.Game;
  private settled=true;
  private training=false;
  private tutorialReturn:Screen='menu';
  private beforeRestart:Modal=null;
  private lastPaused=false;
  private recordTarget=0;
  private recordAnnounced=false;
  constructor(private platform:PlatformPort,private profile:Profile) {
    this.state=profile.game??newGame(seed(),profile.best);
    this.ui=new Interface(action=>this.action(action),(key,value)=>this.setting(key,value));
    this.audio=new AudioService(profile.settings);
    this.platform.onChange=()=>this.platformChanged();
    this.game=new Phaser.Game({
      type:Phaser.AUTO,parent:'game',width:VIEW.width*this.pixelRatio(),height:VIEW.height*this.pixelRatio(),transparent:true,
      render:{antialias:true,pixelArt:false,roundPixels:false},
      input:{mouse:{preventDefaultWheel:false},touch:{capture:true}},
      audio:{noAudio:true},fps:{target:60},scene:[new GameScene(this)],
      scale:{mode:Phaser.Scale.NONE,width:VIEW.width*this.pixelRatio(),height:VIEW.height*this.pixelRatio()},
    });
    window.addEventListener('resize',this.resize);window.visualViewport?.addEventListener('resize',this.resize);
    window.addEventListener('pagehide',()=>this.save());
    window.addEventListener('blur',()=>this.scene?.cancel());
    document.addEventListener('contextmenu',e=>{if((e.target as Element).closest('#frame'))e.preventDefault();});
    this.resize();
  }
  onReady(scene:GameScene):void {
    this.scene=scene;scene.show(false);this.render();
    document.querySelector('#loader')?.remove();this.platform.message('game_ready');this.platformChanged();
  }
  reducedMotion():boolean{return this.profile.settings.reducedMotion;}
  pixelRatio():number{return Math.min(window.devicePixelRatio||1,2);}
  isTutorial():boolean{return this.training;}
  canInteract():boolean{return (this.screen==='game'||this.screen==='tutorial')&&!this.modal&&!this.platform.paused&&!this.state.over&&this.settled;}
  onPick():void{this.audio.play('pick');}
  onPlace(slot:number,x:number,y:number):Placement|null{
    if(!this.canInteract())return null;
    const result=placePiece(this.state,slot,x,y);if(!result)return null;
    this.state=result.state;this.settled=result.cleared.length===0;
    if(!this.training){
      this.profile.best=Math.max(this.profile.best,this.state.best);this.profile.maxCombo=Math.max(this.profile.maxCombo,this.state.maxCombo);
      this.profile.totalLines+=result.rows.length+result.columns.length;this.profile.game=this.state;this.save();
    }
    this.audio.play('place');
    if(!this.training&&!this.recordAnnounced&&this.state.score>this.recordTarget){this.recordAnnounced=true;this.audio.play('record');}
    this.render(true);return result;
  }
  onClearFeedback(result:Placement):void{
    this.audio.play(result.state.combo>1||result.rows.length+result.columns.length>1?'combo':'clear');
  }
  onSettled():void{
    this.settled=true;
    if(this.training&&this.state.lines>0){this.modal='tutorial-success';this.render();}
    else if(this.state.over){this.modal='over';this.audio.setActive(false);this.render();this.platform.gameOver();}
  }
  private resize=():void=>{
    const viewport=document.querySelector<HTMLElement>('#viewport')!,frame=document.querySelector<HTMLElement>('#frame')!;
    const style=getComputedStyle(viewport),left=parseFloat(style.paddingLeft),right=parseFloat(style.paddingRight),top=parseFloat(style.paddingTop),bottom=parseFloat(style.paddingBottom),w=viewport.clientWidth-left-right,h=viewport.clientHeight-top-bottom;
    frame.style.left=`${(viewport.clientWidth+left-right)/2}px`;frame.style.top=`${(viewport.clientHeight+top-bottom)/2}px`;
    frame.style.transform=`translate(-50%, -50%) scale(${Math.min(w/VIEW.width,h/VIEW.height)})`;
    this.scene?.cancel();
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
    else if(['sound','music','mute','reducedMotion'].includes(key)&&typeof value==='boolean')settings[key as Exclude<keyof Settings,'language'>]=value;
    this.audio.configure(settings);this.audio.play('ui');this.save();this.render();
  }
  private action(action:string):void{
    if(this.platform.paused)return;
    if(!this.settled&&!['settings','close'].includes(action))return;
    this.audio.play('ui');
    if(action==='settings'){this.scene.cancel();this.modal='settings';if(this.screen==='game')this.platform.message('level_paused');}
    else if(action==='close'){this.modal=this.modal==='restart'?this.beforeRestart:null;if(!this.modal&&this.screen==='game')this.platform.message('level_resumed');}
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
    this.tutorialReturn=this.screen;this.training=true;this.screen='tutorial';this.modal=null;this.settled=true;
    this.state=tutorialGame(seed(),this.profile.best);this.scene.cancel();this.scene.show(true);this.scene.refresh(true);this.render();
  }
  private startGame(fresh:boolean):void{
    this.scene.cancel();this.training=false;this.screen='game';this.modal=null;this.settled=true;
    this.state=!fresh&&this.profile.game&&!this.profile.game.over?this.profile.game:newGame(seed(),this.profile.best);
    this.recordTarget=this.profile.best;this.recordAnnounced=this.state.score>=this.recordTarget&&this.state.score>0;
    this.profile.game=this.state;this.scene.show(true);this.scene.refresh(true);this.audio.setActive(true);
    this.platform.message('level_started');this.save();this.render();
  }
  private save():void{void this.platform.save(JSON.stringify(this.profile));}
  private render(animateScore=false):void{
    this.ui.render({screen:this.screen,modal:this.modal,state:this.state,profile:this.profile,paused:this.platform.paused,storageAvailable:this.platform.storageAvailable},animateScore);
    this.game?.canvas.setAttribute('aria-label',this.profile.settings.language==='ru'?'Поле 8 на 8. Фигуры: клавиши 1, 2, 3; стрелки; Enter.':'8 by 8 board. Select a piece with 1, 2, 3; move with arrows; place with Enter.');
  }
}
