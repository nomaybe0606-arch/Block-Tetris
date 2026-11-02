import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
mkdirSync('promo/crazygames/video',{recursive:true});
for(const format of ['landscape','portrait']){
  const size=format==='landscape'?'1920:1080':'1080:1620';
  // Fully replace the old baked-in opening before fading over clean gameplay.
  // This also supports newer cover-free raw recordings; no gameplay is retimed.
  const filter=`[0:v]scale=out_range=tv[game];[1:v]scale=${size}:flags=lanczos,format=yuva420p,fade=t=out:st=0.55:d=0.20:alpha=1[cover];[game][cover]overlay=shortest=1,format=yuv420p[video]`;
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`artifacts/crazygames-capture/${format}.webm`,'-loop','1','-framerate','30','-i',`promo/crazygames/covers/grid-pulse-${format}.png`,'-filter_complex',filter,'-map','[video]','-t','18','-an','-c:v','libx264','-preset','medium','-crf','19','-r','30','-pix_fmt','yuv420p','-color_range','tv','-movflags','+faststart',`promo/crazygames/video/grid-pulse-${format}.mp4`],{stdio:'inherit'});
}
writeFileSync('promo/crazygames/capture-reports.json',JSON.stringify(Object.fromEntries(['landscape','portrait'].map(name=>[name,JSON.parse(readFileSync(`artifacts/crazygames-capture/${name}.json`,'utf8'))])),null,2)+'\n');
