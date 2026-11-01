import { strings, type Copy } from '../localization/strings';
import type { GameState } from '../core/types';
import type { Profile } from '../platform/profile';
import { icon, logo } from './icons';
import { swapModal, type SwapUI } from './SwapModal';
import { ANIMATION } from '../config/animation';
import { MONETIZATION } from '../config/monetization';

export type Screen = 'menu' | 'game' | 'tutorial';
export type Modal = 'settings' | 'restart' | 'over' | 'tutorial-success' | 'swap' | null;
export interface UIModel {
  screen: Screen; modal: Modal; state: GameState; profile: Profile; paused: boolean; storageAvailable: boolean;
  swap:SwapUI;
}
const number = (n: number) => n.toLocaleString('en-US').replaceAll(',', ' ');
const action = (id: string, label: string, cls = 'secondary', glyph = '') => `<button type="button" class="${cls}" data-action="${id}">${glyph ? icon(glyph) : ''}<span>${label}</span>${cls.includes('primary') ? icon('arrow') : ''}</button>`;
const iconButton = (id: string, label: string, glyph: string) => `<button type="button" class="icon-button" data-action="${id}" aria-label="${label}" title="${label}">${icon(glyph)}</button>`;

export class Interface {
  private root = document.querySelector<HTMLDivElement>('#ui')!;
  private scoreFrame = 0;
  private scoreValue = 0;
  private scoreTarget = -1;
  private scoreNode:Element|null=null;
  private priorFocus: HTMLElement | null = null;
  private hadModal = false;
  private lastScreen:Screen|null=null;
  private screenRoot=document.createElement('div');
  private dialogRoot=document.createElement('div');
  private pauseRoot=document.createElement('div');
  private screenKey='';private modalKey='';private modalMarkup='';private pauseKey='';
  private fragments=new WeakMap<Element,string>();
  private animations=new Set<Animation>();
  constructor(private onAction: (action: string) => void, private onSetting: (key: string, value: boolean | string) => void) {
    for(const host of [this.screenRoot,this.dialogRoot,this.pauseRoot]){host.className='ui-host';this.root.append(host);}
    this.root.addEventListener('click', e => {
      const button = (e.target as Element).closest<HTMLButtonElement>('[data-action]');
      if(button) this.onAction(button.dataset.action!);
    });
    this.root.addEventListener('change', e => {
      const control = e.target as HTMLInputElement;
      if(control.dataset.setting) this.onSetting(control.dataset.setting,control.type==='checkbox'?control.checked:control.value);
    });
    document.addEventListener('keydown',e=>{
      const dialog=this.root.querySelector<HTMLElement>('[role="dialog"]');
      if(!dialog)return;
      if(e.key==='Escape'&&dialog.dataset.dismissible==='true'){e.preventDefault();this.onAction('close');}
      if(e.key==='Tab'){
        const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)'));
        const first=controls[0],last=controls[controls.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    });
  }
  render(model: UIModel, animateScore = false): void {
    const focusedSetting=(document.activeElement as HTMLElement | null)?.dataset.setting;
    const c:Copy=strings[model.profile.settings.language];
    document.documentElement.lang=model.profile.settings.language;
    document.querySelector('#frame')!.classList.toggle('reduced-motion',model.profile.settings.reducedMotion);
    document.querySelector('#frame')!.classList.toggle('low-effects',!model.profile.settings.intenseEffects);
    if(model.profile.settings.reducedMotion){for(const animation of this.animations)animation.cancel();this.animations.clear();this.root.querySelector('.record-active')?.classList.remove('record-active');}
    if(model.modal&&!this.hadModal)this.priorFocus=document.activeElement as HTMLElement;
    const menuKey=model.screen==='menu'?`:${model.profile.best}:${model.profile.totalLines}:${model.profile.maxCombo}:${!!(model.profile.game&&!model.profile.game.over)}`:'';
    const screenKey=`${model.screen}:${model.profile.settings.language}${menuKey}`;
    if(screenKey!==this.screenKey){
      this.screenRoot.innerHTML=model.screen==='menu'?this.menu(model,c):this.game(model,c);this.screenKey=screenKey;
      if(this.lastScreen!==model.screen&&!model.profile.settings.reducedMotion&&this.screenRoot.firstElementChild)this.animate(this.screenRoot.firstElementChild,[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:ANIMATION.modalMs,easing:'ease-out'});
    }
    this.lastScreen=model.screen;
    if(model.screen!=='menu')this.patchGame(model,c);
    this.patchModal(model,c);
    const pauseKey=model.paused?model.profile.settings.language:'';
    if(pauseKey!==this.pauseKey){this.pauseRoot.innerHTML=model.paused?`<div class="pause-screen"><div class="pause-orbit">${icon('moon')}</div><h2>${c.paused}</h2><p>${c.pausedHelp}</p></div>`:'';this.pauseKey=pauseKey;}
    if(model.modal&&!this.hadModal)requestAnimationFrame(()=>this.root.querySelector<HTMLElement>('[role="dialog"] button, [role="dialog"] input')?.focus());
    if(!model.modal&&this.hadModal){const label=this.priorFocus?.getAttribute('data-action');if(label)this.root.querySelector<HTMLElement>(`[data-action="${label}"]`)?.focus();}
    this.hadModal=!!model.modal;
    if(focusedSetting&&model.modal==='settings')this.root.querySelector<HTMLElement>(`[data-setting="${focusedSetting}"]`)?.focus();
    if(model.screen!=='menu')this.animateScore(model.state.score,animateScore&&!model.profile.settings.reducedMotion,model.profile.settings.reducedMotion);
  }
  private animate(element:Element,frames:Keyframe[],options:KeyframeAnimationOptions):Animation{
    const animation=element.animate(frames,options);this.animations.add(animation);
    void animation.finished.then(()=>this.animations.delete(animation),()=>this.animations.delete(animation));return animation;
  }
  private text(selector:string,value:string):void{const element=this.screenRoot.querySelector(selector);if(element&&element.textContent!==value)element.textContent=value;}
  private fragment(selector:string,html:string):void{
    const element=this.screenRoot.querySelector(selector);if(element&&this.fragments.get(element)!==html){element.innerHTML=html;this.fragments.set(element,html);}
  }
  private patchGame(m:UIModel,c:Copy):void{
    this.text('#best-value',number(m.screen==='tutorial'?m.profile.best:m.state.best));
    this.fragment('.board-meta',`<span><i></i>${c.classic} <b>8 × 8</b></span><span>${m.state.combo>1?`<em>${c.combo} ${Math.min(8,m.state.combo)}×</em>`:`${c.lines} <strong>${m.state.lines}</strong>`}</span>`);
    this.fragment('#tray-action',this.trayAction(m,c));
    this.text('.storage-status',m.storageAvailable?'':c.savingError);
    this.screenRoot.querySelector('.storage-status')?.classList.toggle('storage-error',!m.storageAvailable);
  }
  private patchModal(m:UIModel,c:Copy):void{
    const key=m.modal?`${m.modal}:${m.profile.settings.language}`:'';
    if(key!==this.modalKey){this.modalMarkup=m.modal?this.modal(m,c):'';this.dialogRoot.innerHTML=this.modalMarkup;this.modalKey=key;return;}
    if(m.modal==='settings'){
      for(const input of this.dialogRoot.querySelectorAll<HTMLInputElement>('input[data-setting]')){
        const checked=!!m.profile.settings[input.dataset.setting as keyof typeof m.profile.settings];if(input.checked!==checked)input.checked=checked;
      }
    }else if(m.modal){
      const html=this.modal(m,c);if(html===this.modalMarkup)return;this.modalMarkup=html;
      // Keep the dialog/backdrop animation and focus scope alive across ad status updates.
      const template=document.createElement('template');template.innerHTML=html;
      const fresh=template.content.querySelector<HTMLElement>('[role="dialog"]')!,dialog=this.dialogRoot.querySelector<HTMLElement>('[role="dialog"]')!;
      const focused=(document.activeElement as HTMLElement|null)?.dataset.action;
      dialog.replaceChildren(...Array.from(fresh.childNodes));dialog.dataset.dismissible=fresh.dataset.dismissible;
      if(focused)dialog.querySelector<HTMLElement>(`[data-action="${focused}"]:not(:disabled)`)?.focus();
    }
  }
  private trayAction(m:UIModel,c:Copy):string{
    return m.swap.visible?`<button class="swap-button" data-action="swap" ${m.swap.remaining===0?'disabled':''}>${icon('video')}<span>${c.swapButton}</span><b>${m.swap.remaining}/${MONETIZATION.maxSwapsPerGame}</b></button>`:`<div class="game-footer">${m.screen==='tutorial'?c.tutorialHelp:c.dragHint}</div>`;
  }
  private menu(m:UIModel,c:Copy):string {
    const hasGame=m.profile.game&&!m.profile.game.over;
    return `<div class="menu-screen"><header class="topbar"><div class="brand">${logo}</div>${iconButton('settings',c.settings,'settings')}</header>
      <div class="menu-copy"><p class="eyebrow">${c.menuEyebrow}</p><h1>${c.menuTitle}</h1><p>${c.menuDescription}</p></div>
      <div class="hero-art" aria-hidden="true"><div class="hero-glow"></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
        <div class="hero-piece hero-purple"><i></i><i></i><i></i><i></i></div><div class="hero-piece hero-cyan"><i></i><i></i><i></i></div><div class="hero-piece hero-gold"><i></i><i></i><i></i><i></i></div>
        <span class="spark spark-one"></span><span class="spark spark-two"></span><span class="spark spark-three"></span>
      </div>
      <div class="menu-bottom"><div class="best-pill">${icon('trophy')}<span>${c.best}</span><strong>${number(m.profile.best)}</strong></div>
        ${action('play',hasGame?c.continue:c.play,'primary')}
        <div class="menu-secondary">${hasGame?action('new',c.newGame,'text-button','restart'):''}${action('tutorial',c.howTo,'text-button','help')}</div>
        <p class="quiet-line"><span></span>${c.relaxed}<span></span></p>
        <div class="menu-stats"><div><strong>${number(m.profile.totalLines)}</strong><span>${c.totalLines}</span></div><div class="stat-divider"></div><div><strong>${m.profile.maxCombo}×</strong><span>${c.maxCombo}</span></div></div>
      </div><footer class="menu-footer">8 × 8 <span>·</span> GRID PULSE</footer></div>`;
  }
  private game(m:UIModel,c:Copy):string {
    const training=m.screen==='tutorial';
    return `<div class="game-ui"><header class="topbar"><button class="brand brand-button" data-action="home" aria-label="${c.home}">${logo}</button>${iconButton('settings',c.settings,'settings')}</header>
      <div class="score-panel"><p class="eyebrow">${training?c.tutorial:c.score}</p><div id="score-value" class="score-value" aria-live="off">${number(m.state.score)}</div></div>
      <div class="record-pill">${icon('trophy')}<span>${c.best}</span><strong id="best-value">${number(training?m.profile.best:m.state.best)}</strong></div>
      <div class="board-meta"><span><i></i>${c.classic} <b>8 × 8</b></span><span>${m.state.combo>1?`<em>${c.combo} ${Math.min(8,m.state.combo)}×</em>`:`${c.lines} <strong>${m.state.lines}</strong>`}</span></div>
      <div class="tray-label"><span></span>${training?c.tutorialHint:c.tray}<span></span></div>
      <div id="tray-action" class="ui-host">${this.trayAction(m,c)}</div>
      ${training?action('skip',c.skip,'tutorial-skip'):''}
      <div class="storage-status ${m.storageAvailable?'':'storage-error'}" role="status">${m.storageAvailable?'':c.savingError}</div>
      <span class="sr-only">${c.keyboard}</span>
    </div>`;
  }
  private modal(m:UIModel,c:Copy):string {
    let body='';
    if(m.modal==='settings') {
      const toggle=(key:string,title:string,glyph:string,help='')=>`<label class="setting-row"><span class="setting-icon">${icon(glyph)}</span><span class="setting-title">${title}${help?`<small>${help}</small>`:''}</span><input type="checkbox" role="switch" data-setting="${key}" ${(m.profile.settings[key as keyof typeof m.profile.settings])?'checked':''}/><span class="switch" aria-hidden="true"></span></label>`;
      body=`<div class="modal-heading"><div><p class="eyebrow">GRID PULSE</p><h2>${c.settings}</h2></div>${iconButton('close',c.close,'close')}</div>
        <div class="settings-list">${toggle('sound',c.sound,'sound')}${toggle('music',c.music,'music')}${toggle('mute',c.mute,'sound')}${toggle('reducedMotion',c.motion,'moon',c.motionHelp)}${toggle('intenseEffects',c.effects,'sparkle')}
        <label class="setting-row"><span class="setting-icon">${icon('globe')}</span><span class="setting-title">${c.language}</span><select data-setting="language" aria-label="${c.language}"><option value="en" ${m.profile.settings.language==='en'?'selected':''}>English</option><option value="ru" ${m.profile.settings.language==='ru'?'selected':''}>Русский</option></select></label></div>
        ${action('close',c.close,'primary')}${m.screen==='game'?`<div class="settings-actions">${action('new',c.newGame,'text-button','restart')}${action('home',c.home,'text-button','home')}</div>`:''}`;
    } else if(m.modal==='swap') {
      body=swapModal(m.state,m.swap,c);
    } else if(m.modal==='restart') {
      body=`<div class="modal-symbol">${icon('restart')}</div><h2>${c.restart}</h2><p class="modal-description">${c.restartHelp}</p>${action('confirm-new',c.confirm,'primary')}${action('close',c.cancel,'secondary')}`;
    } else if(m.modal==='tutorial-success') {
      body=`<div class="modal-symbol mint">${icon('check')}</div><p class="eyebrow">GOOD!</p><h2>${c.tutorialSuccess}</h2><p class="modal-description">${c.tutorialSuccessHelp}</p>${action('finish-tutorial',c.tutorialStart,'primary')}`;
    } else {
      body=`<div class="modal-symbol gold">${icon('trophy')}</div><p class="eyebrow">${c.noMoves}</p><h2>${c.over}</h2><p class="modal-description">${c.overHelp}</p>
      <div class="results"><div><span>${c.resultScore}</span><strong>${number(m.state.score)}</strong></div><div><span>${c.resultBest}</span><strong>${number(m.profile.best)}</strong></div></div>
      <div class="result-details"><span>${c.lines} <b>${m.state.lines}</b></span><span>${c.maxCombo} <b>${m.state.maxCombo}×</b></span></div>
      ${action('confirm-new',c.again,'primary')}${action('home',c.home,'secondary')}`;
    }
    return `<div class="modal-backdrop"><section role="dialog" aria-modal="true" aria-label="${m.modal==='settings'?c.settings:m.modal==='swap'?c.swapTitle:m.modal==='restart'?c.restart:m.modal==='over'?c.noMoves:c.tutorialSuccess}" data-dismissible="${m.modal==='settings'||m.modal==='restart'||(m.modal==='swap'&&!m.swap.busy&&!m.swap.savePending)}" class="modal ${m.modal==='settings'?'settings-modal':''}">${body}</section></div>`;
  }
  private animateScore(target:number,animate:boolean,instant=false):void {
    const element=this.root.querySelector('#score-value');if(!element)return;
    if(this.scoreNode===element&&this.scoreTarget===target&&!instant)return;
    cancelAnimationFrame(this.scoreFrame);
    const sameNode=this.scoreNode===element;this.scoreNode=element;this.scoreTarget=target;
    if(!animate||!sameNode){this.scoreValue=target;element.textContent=number(target);return;}
    const start=animate?this.scoreValue:target,startTime=performance.now();
    element.textContent=number(start);
    this.animate(element,[{transform:'scale(1)'},{transform:'scale(1.035)'},{transform:'scale(1)'}],{duration:ANIMATION.scoreMs,easing:'ease-out'});
    const step=(time:number)=>{
      const progress=Math.min(1,Math.max(0,(time-startTime)/ANIMATION.scoreMs)),value=Math.round(start+(target-start)*(1-(1-progress)**3));
      element.textContent=number(value);this.scoreValue=value;
      if(progress<1)this.scoreFrame=requestAnimationFrame(step);
    };this.scoreFrame=requestAnimationFrame(step);
  }
  closeDialog(reduced:boolean,done:()=>void):void{
    const dialog=this.root.querySelector<HTMLElement>('[role="dialog"]');
    if(!dialog||reduced){done();return;}
    void this.animate(dialog,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(6px) scale(.98)'}],{duration:ANIMATION.modalMs*.65,easing:'ease-in',fill:'forwards'}).finished.then(done,done);
  }
  record(reduced:boolean):void{
    if(reduced)return;
    requestAnimationFrame(()=>{
      const trophy=this.root.querySelector<HTMLElement>('.record-pill');
      trophy?.classList.add('record-active');
      const celebration=trophy?this.animate(trophy,[{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:ANIMATION.recordMs,easing:'ease-out'}):null;
      void celebration?.finished.then(()=>trophy?.classList.remove('record-active'),()=>trophy?.classList.remove('record-active'));
    });
  }
}
