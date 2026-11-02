// Normalize the retained original imagegen artwork without changing composition.
import {execFileSync} from 'node:child_process';
for(const [name,size] of [['landscape','1920:1080'],['portrait','800:1200'],['square','800:800']])execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`promo/crazygames/source/${name}.png`,'-vf',`scale=${size}:flags=lanczos`,'-frames:v','1',`promo/crazygames/covers/grid-pulse-${name}.png`],{stdio:'inherit'});
