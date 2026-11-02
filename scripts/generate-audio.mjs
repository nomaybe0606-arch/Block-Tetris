// Original Grid Tetris compositions. Offline rendering only: runtime plays the committed OGG assets.
// Requires ffmpeg on PATH; not required for installation, development, or production builds.
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const dir=resolve('public/assets/audio');mkdirSync(dir,{recursive:true});
const rate=44100, TAU=Math.PI*2;
const note=n=>440*2**((n-69)/12);
function render(name,length,compose){
  const size=Math.ceil(length*rate),data=new Float64Array(size);compose(data);
  const pcm=Buffer.alloc(size*2);
  for(let i=0;i<size;i++)pcm.writeInt16LE(Math.round(Math.tanh(data[i])*0.86*32767),i*2);
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  const wav=resolve(dir,`${name}.wav`);writeFileSync(wav,Buffer.concat([header,pcm]));
  const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wav,'-c:a','libvorbis','-q:a',name==='ambient'?'3':'4',resolve(dir,`${name}.ogg`)],{stdio:'inherit',windowsHide:true});
  if(result.status!==0)throw new Error(`ffmpeg failed for ${name}: ${result.error??result.status}`);
  const mp3=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wav,'-c:a','libmp3lame','-b:a',name==='ambient'?'96k':'128k',resolve(dir,`${name}.mp3`)],{stdio:'inherit',windowsHide:true});
  if(mp3.status!==0)throw new Error(`MP3 encoding failed for ${name}: ${mp3.error??mp3.status}`);
  unlinkSync(wav);
}
function bell(data,start,midi,duration,gain=.2){
  const freq=note(midi),from=Math.floor(start*rate),samples=Math.ceil(duration*rate);
  for(let i=0;i<samples;i++){
    const t=i/rate,env=(1-Math.exp(-t*170))*Math.exp(-t*6/duration)*(1-(i/samples)**8);
    const fundamental=Math.sin(TAU*freq*t),overtone=.26*Math.sin(TAU*freq*2.003*t)*Math.exp(-t*7);
    data[(from+i)%data.length]+=(fundamental+overtone)*env*gain;
  }
}
function echo(data,delay,gain){const source=new Float64Array(data),offset=Math.round(delay*rate);for(let i=0;i<data.length;i++)data[(i+offset)%data.length]+=source[i]*gain;}
render('pick',.18,d=>{bell(d,0,83,.14,.2);bell(d,.025,90,.12,.06);});
render('ui',.15,d=>bell(d,0,78,.11,.16));
render('place',.24,d=>{bell(d,0,57,.2,.24);bell(d,.012,69,.16,.13);});
render('clear',.75,d=>{[72,76,79,84].forEach((n,i)=>bell(d,i*.055,n,.4,.19));echo(d,.13,.18);});
render('combo',1.05,d=>{[72,76,79,83,86,91].forEach((n,i)=>bell(d,i*.065,n,.45,.16));echo(d,.17,.21);});
render('record',1.8,d=>{[67,72,76,79,84,88,91].forEach((n,i)=>bell(d,i*.12,n,.65,.17));[72,79,84].forEach(n=>bell(d,.95,n,.7,.08));echo(d,.2,.22);});
render('ambient',32,d=>{
  // 4 bars at 60 BPM: Cmaj9 — Am9 — Fmaj9 — G6. Eight-second harmonic phrases.
  const chords=[[48,55,59,62,64],[45,52,55,59,60],[41,48,52,55,57],[43,50,55,57,59]];
  chords.forEach((chord,bar)=>{
    chord.forEach((n,j)=>{
      const freq=note(n),start=bar*8;
      for(let i=0;i<rate*10;i++){
        const t=i/rate,env=Math.sin(Math.PI*Math.min(1,t/10))**2;
        const wave=Math.sin(TAU*freq*t)+.14*Math.sin(TAU*freq*2*t)+.04*Math.sin(TAU*freq*3*t);
        d[(Math.floor(start*rate)+i)%d.length]+=wave*env*.024*(1+.07*Math.sin(TAU*.17*t+j));
      }
    });
    [0,2,4,3,1,2,4,1].forEach((index,beat)=>bell(d,bar*8+beat,chord[index]+24,1.8,.065));
    bell(d,bar*8,chord[0]-12,3,.07);bell(d,bar*8+4,chord[0]-12,3,.05);
  });echo(d,.375,.24);echo(d,.75,.12);
});
console.log('Rendered 7 original audio assets in OGG and MP3.');
