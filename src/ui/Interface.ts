import { strings, type Copy } from '../localization/strings';
import type { GameState } from '../core/types';
import type { Profile } from '../platform/profile';
import { icon, logo } from './icons';

export type Screen = 'menu' | 'game' | 'tutorial';
export type Modal = 'settings' | 'restart' | 'over' | 'tutorial-success' | null;
export interface UIModel {
  screen: Screen; modal: Modal; state: GameState; profile: Profile; paused: boolean; storageAvailable: boolean;
}
const number = (n: number) => n.toLocaleString('en-US').replaceAll(',', ' ');
const action = (id: string, label: string, cls = 'secondary', glyph = '') => `<button type="button" class="${cls}" data-action="${id}">${glyph ? icon(glyph) : ''}<span>${label}</span>${cls.includes('primary') ? icon('arrow') : ''}</button>`;
const iconButton = (id: string, label: string, glyph: string) => `<button type="button" class="icon-button" data-action="${id}" aria-label="${label}" title="${label}">${icon(glyph)}</button>`;

export class Interface {
  private root = document.querySelector<HTMLDivElement>('#ui')!;
  private scoreFrame = 0;
  private scoreValue = 0;
  private priorFocus: HTMLElement | null = null;
  private hadModal = false;
  constructor(private onAction: (action: string) => void, private onSetting: (key: string, value: boolean | string) => void) {
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
        const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button, input, select'));
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
    if(model.modal&&!this.hadModal)this.priorFocus=document.activeElement as HTMLElement;
    this.root.innerHTML=model.screen==='menu'?this.menu(model,c):this.game(model,c);
    if(model.modal)this.root.insertAdjacentHTML('beforeend',this.modal(model,c));
    if(model.paused)this.root.insertAdjacentHTML('beforeend',`<div class="pause-screen"><div class="pause-orbit">${icon('moon')}</div><h2>${c.paused}</h2><p>${c.pausedHelp}</p></div>`);
    if(model.modal&&!this.hadModal)requestAnimationFrame(()=>this.root.querySelector<HTMLElement>('[role="dialog"] button, [role="dialog"] input')?.focus());
    if(!model.modal&&this.hadModal){const label=this.priorFocus?.getAttribute('data-action');if(label)this.root.querySelector<HTMLElement>(`[data-action="${label}"]`)?.focus();}
    this.hadModal=!!model.modal;
    if(focusedSetting&&model.modal==='settings')this.root.querySelector<HTMLElement>(`[data-setting="${focusedSetting}"]`)?.focus();
    if(model.screen!=='menu')this.animateScore(model.state.score,animateScore&&!model.profile.settings.reducedMotion);
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
      <div class="game-footer">${training?c.tutorialHelp:c.dragHint}</div>
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
        <div class="settings-list">${toggle('sound',c.sound,'sound')}${toggle('music',c.music,'music')}${toggle('mute',c.mute,'sound')}${toggle('reducedMotion',c.motion,'moon',c.motionHelp)}
        <label class="setting-row"><span class="setting-icon">${icon('globe')}</span><span class="setting-title">${c.language}</span><select data-setting="language" aria-label="${c.language}"><option value="en" ${m.profile.settings.language==='en'?'selected':''}>English</option><option value="ru" ${m.profile.settings.language==='ru'?'selected':''}>Русский</option></select></label></div>
        ${action('close',c.close,'primary')}${m.screen==='game'?`<div class="settings-actions">${action('new',c.newGame,'text-button','restart')}${action('home',c.home,'text-button','home')}</div>`:''}`;
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
    return `<div class="modal-backdrop"><section role="dialog" aria-modal="true" aria-label="${m.modal==='settings'?c.settings:m.modal==='restart'?c.restart:m.modal==='over'?c.noMoves:c.tutorialSuccess}" data-dismissible="${m.modal==='settings'||m.modal==='restart'}" class="modal ${m.modal==='settings'?'settings-modal':''}">${body}</section></div>`;
  }
  private animateScore(target:number,animate:boolean):void {
    cancelAnimationFrame(this.scoreFrame);
    const element=this.root.querySelector('#score-value');if(!element)return;
    const start=animate?this.scoreValue:target,startTime=performance.now();
    const step=(time:number)=>{
      const progress=Math.min(1,(time-startTime)/350),value=Math.round(start+(target-start)*(1-(1-progress)**3));
      element.textContent=number(value);this.scoreValue=value;
      if(progress<1)this.scoreFrame=requestAnimationFrame(step);
    };this.scoreFrame=requestAnimationFrame(step);
  }
}
