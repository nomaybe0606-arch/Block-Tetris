import {afterEach,describe,expect,it,vi} from 'vitest';
import {Window} from 'happy-dom';
import {AudioService} from '../src/audio/AudioService';
import {defaultProfile} from '../src/platform/profile';
const media:Media[]=[];let seeks=0;let context:Context;
class Media{
  paused=true;ended=false;loop=false;volume=1;preload='';constructor(readonly src=''){media.push(this);}
  canPlayType(){return '';}
  set currentTime(_value:number){seeks++;}
  play=vi.fn(async()=>{this.paused=false;});pause=vi.fn(()=>{this.paused=true;});
}
class Voice{buffer:unknown;onended:(()=>void)|null=null;connect=vi.fn();disconnect=vi.fn();start=vi.fn();stop=vi.fn();}
class Context{
  state='suspended';destination={};sources:Voice[]=[];constructor(){context=this;}
  createGain(){return {gain:{value:0},connect:vi.fn()};}
  decodeAudioData=vi.fn(async()=>({}));resume=vi.fn(async()=>{this.state='running';});close=vi.fn(async()=>{this.state='closed';});
  createBufferSource(){const voice=new Voice();this.sources.push(voice);return voice;}
}
const doms:Window[]=[];
function setup(supported=true,loaded=true){
  media.length=0;seeks=0;const dom=new Window();doms.push(dom);vi.stubGlobal('document',dom.document);vi.stubGlobal('window',{AudioContext:supported?Context:undefined});vi.stubGlobal('Audio',Media);
  vi.stubGlobal('fetch',loaded?vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})):vi.fn(()=>new Promise(()=>{})));
  const settings=defaultProfile('en',false).settings,audio=new AudioService(settings);return {audio,settings,unlock:()=>dom.document.dispatchEvent(new dom.Event('pointerdown'))};
}
afterEach(()=>{for(const dom of doms)dom.close();doms.length=0;vi.unstubAllGlobals();});
describe('decoded sound buffers',()=>{
  it('falls back safely if a browser refuses to start a decoded cue',async()=>{
    const s=setup();await vi.waitFor(()=>expect(context.decodeAudioData).toHaveBeenCalledTimes(6));s.unlock();
    vi.spyOn(context,'createBufferSource').mockImplementation(()=>{const voice=new Voice();voice.start.mockImplementation(()=>{throw new Error('Audio interrupted');});return voice;});
    expect(()=>s.audio.play('clear')).not.toThrow();expect(s.audio.stats.audioVoices).toBe(0);expect(media).toHaveLength(5);s.audio.destroy();
  });
  it('decodes each clip once and plays 100 cues without a media seek or creating HTML sound players',async()=>{
    const s=setup();await vi.waitFor(()=>expect(context.decodeAudioData).toHaveBeenCalledTimes(6));expect(fetch).toHaveBeenCalledTimes(6);
    s.audio.play('pick');expect(context.sources).toHaveLength(0);s.unlock();
    for(let i=0;i<100;i++)s.audio.play('clear');expect(context.sources).toHaveLength(100);expect(media).toHaveLength(2);expect(seeks).toBe(0);
    expect(context.sources.filter(source=>source.stop.mock.calls.length===0)).toHaveLength(12);s.audio.destroy();
  });
  it('stops effects on host pause/mute and only plays again once allowed',async()=>{
    const s=setup();await vi.waitFor(()=>expect(context.decodeAudioData).toHaveBeenCalledTimes(6));s.unlock();s.audio.play('record');const voice=context.sources[0];
    s.audio.setBlocked(true);expect(voice.stop).toHaveBeenCalledTimes(1);s.audio.play('ui');expect(context.sources).toHaveLength(1);
    s.audio.setBlocked(false);s.audio.configure({...s.settings,mute:true});s.audio.play('pick');expect(context.sources).toHaveLength(1);
    s.audio.configure(s.settings);s.audio.play('pick');expect(context.sources).toHaveLength(2);s.audio.destroy();
  });
  it('does not open a media decoder during a gesture while buffers are still loading',()=>{
    const s=setup(true,false);s.unlock();for(let i=0;i<100;i++)s.audio.play('pick');expect(media).toHaveLength(2);expect(seeks).toBe(0);s.audio.destroy();
  });
  it('lazily reuses the fallback pool if Web Audio is unavailable',()=>{
    const s=setup(false);s.unlock();for(let i=0;i<100;i++)s.audio.play('clear');expect(media).toHaveLength(5);expect(fetch).not.toHaveBeenCalled();s.audio.destroy();
  });
  it('disconnects finished voices and removes unlock listeners on destruction',async()=>{
    const s=setup();await vi.waitFor(()=>expect(context.decodeAudioData).toHaveBeenCalledTimes(6));s.unlock();s.audio.play('pick');const voice=context.sources[0];voice.onended!();expect(voice.disconnect).toHaveBeenCalledTimes(1);
    s.audio.destroy();const resumes=context.resume.mock.calls.length;s.unlock();expect(context.resume).toHaveBeenCalledTimes(resumes);expect(context.close).toHaveBeenCalledTimes(1);
  });
});
