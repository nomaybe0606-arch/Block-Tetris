import type { Settings } from '../platform/profile';
export type SoundName = 'pick' | 'place' | 'clear' | 'combo' | 'record' | 'ui';
const sounds:SoundName[]=['pick','place','clear','combo','record','ui'];
/** Frequent cues share decoded buffers, without media seeks/decoder startup per gesture. */
export class AudioService {
  private extension=new Audio().canPlayType('audio/ogg; codecs="vorbis"')?'ogg':'mp3';
  private music=new Audio(`${import.meta.env.BASE_URL}assets/audio/ambient.${this.extension}`);
  private context:AudioContext|null=null;private gain:GainNode|null=null;
  private buffers=new Map<SoundName,AudioBuffer>();private failed=new Set<SoundName>();
  private voices=new Set<AudioBufferSourceNode>();private fallback=new Map<SoundName,HTMLAudioElement[]>();
  private unlocked=false;private blocked=false;private active=true;private settings:Settings;
  constructor(settings:Settings){
    this.settings=settings;this.music.loop=true;this.music.volume=.2;this.music.preload='auto';
    try{
      const Context=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(Context){this.context=new Context();this.gain=this.context.createGain();this.gain.gain.value=.45;this.gain.connect(this.context.destination);for(const name of sounds)void this.load(name);}
    }catch{this.context=null;}
    document.addEventListener('pointerdown',this.unlock,{capture:true});document.addEventListener('keydown',this.unlock,{capture:true});
  }
  private async load(name:SoundName):Promise<void>{
    try{const response=await fetch(`${import.meta.env.BASE_URL}assets/audio/${name}.${this.extension}`);if(!response.ok)throw new Error('Audio unavailable');this.buffers.set(name,await this.context!.decodeAudioData(await response.arrayBuffer()));}
    catch{this.failed.add(name);}
  }
  private unlock=():void=>{
    const first=!this.unlocked;this.unlocked=true;
    if(this.context&&this.context.state!=='running'&&this.context.state!=='closed')void this.context.resume().catch(()=>{});
    if(first||this.music.paused)this.sync();
  };
  configure(settings:Settings):void{this.settings=settings;this.sync();}
  get stats():{audioBuffers:number;audioVoices:number}{return {audioBuffers:this.buffers.size,audioVoices:this.voices.size};}
  setBlocked(blocked:boolean):void{if(this.blocked===blocked)return;this.blocked=blocked;this.sync();}
  setActive(active:boolean):void{if(this.active===active)return;this.active=active;this.sync();}
  private stopVoices():void{for(const voice of this.voices){voice.onended=null;try{voice.stop();}catch{}voice.disconnect();}this.voices.clear();}
  private sync():void{
    if(!this.unlocked||this.blocked||!this.active||this.settings.mute||!this.settings.music){if(!this.music.paused)this.music.pause();}
    else if(this.music.paused)void this.music.play().catch(()=>{});
    if(this.blocked||this.settings.mute||!this.settings.sound){this.stopVoices();for(const pool of this.fallback.values())for(const audio of pool)if(!audio.paused){audio.pause();audio.currentTime=0;}}
  }
  play(name:SoundName):void{
    if(!this.unlocked||this.blocked||this.settings.mute||!this.settings.sound)return;
    const buffer=this.buffers.get(name);
    if(this.context&&this.gain&&buffer&&!this.failed.has(name)){
      if(this.voices.size>=12){const oldest=this.voices.values().next().value!;oldest.onended=null;oldest.stop();oldest.disconnect();this.voices.delete(oldest);}
      let voice:AudioBufferSourceNode|undefined;
      try{voice=this.context.createBufferSource();voice.buffer=buffer;voice.connect(this.gain);this.voices.add(voice);const started=voice;voice.onended=()=>{this.voices.delete(started);started.disconnect();};voice.start();return;}
      catch{if(voice){this.voices.delete(voice);voice.disconnect();}this.failed.add(name);}
    }
    // Loading a buffer must not start an HTML decoder in the middle of a drag.
    if(this.context&&!this.failed.has(name))return;
    let pool=this.fallback.get(name);if(!pool){pool=Array.from({length:3},()=>{const audio=new Audio(`${import.meta.env.BASE_URL}assets/audio/${name}.${this.extension}`);audio.volume=.45;audio.preload='auto';return audio;});this.fallback.set(name,pool);}
    const audio=pool.find(item=>item.paused||item.ended)??pool[0];audio.currentTime=0;void audio.play().catch(()=>{});
  }
  destroy():void{document.removeEventListener('pointerdown',this.unlock,true);document.removeEventListener('keydown',this.unlock,true);this.stopVoices();this.music.pause();for(const pool of this.fallback.values())for(const audio of pool)audio.pause();if(this.context)void this.context.close().catch(()=>{});}
}
