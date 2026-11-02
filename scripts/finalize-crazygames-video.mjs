import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
mkdirSync('promo/crazygames/video',{recursive:true});
for(const format of ['landscape','portrait'])execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`artifacts/crazygames-capture/${format}.webm`,'-t','18','-an','-vf','scale=out_range=tv','-c:v','libx264','-preset','medium','-crf','19','-r','30','-pix_fmt','yuv420p','-color_range','tv','-movflags','+faststart',`promo/crazygames/video/grid-pulse-${format}.mp4`],{stdio:'inherit'});
writeFileSync('promo/crazygames/capture-reports.json',JSON.stringify(Object.fromEntries(['landscape','portrait'].map(name=>[name,JSON.parse(readFileSync(`artifacts/crazygames-capture/${name}.json`,'utf8'))])),null,2)+'\n');
