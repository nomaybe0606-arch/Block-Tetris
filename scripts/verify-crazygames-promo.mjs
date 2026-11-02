import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const gridReview=JSON.parse(readFileSync('promo/crazygames/grid-review.json','utf8'));
function checkReviewedGrid(path){
  const entry=gridReview.files.find(item=>item.path===path);assert(entry,`Missing visual grid review: ${path}`);
  assert.equal(entry.sha256,createHash('sha256').update(readFileSync(path)).digest('hex'),`Media changed: repeat the visual 8×8 review for ${path}`);
  assert.equal(entry.rows,8);assert.equal(entry.columns,8);
}
const report={covers:[],videos:[]};
for(const entry of gridReview.files)checkReviewedGrid(entry.path);
for(const [name,w,h] of [['landscape',1920,1080],['portrait',800,1200],['square',800,800]]){
  const path=`promo/crazygames/covers/grid-pulse-${name}.png`,png=readFileSync(path);checkReviewedGrid(path);assert.equal(png.toString('ascii',1,4),'PNG');assert.equal(png.readUInt32BE(16),w);assert.equal(png.readUInt32BE(20),h);report.covers.push({path,width:w,height:h,bytes:png.length,reviewedGrid:{rows:8,columns:8}});
}
for(const [name,w,h] of [['landscape',1920,1080],['portrait',1080,1620]]){
  const path=`promo/crazygames/video/grid-pulse-${name}.mp4`,metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'})),v=metadata.streams.find(s=>s.codec_type==='video');
  checkReviewedGrid(path);assert(v);assert.equal(v.width,w);assert.equal(v.height,h);assert.equal(v.codec_name,'h264');assert.equal(v.pix_fmt,'yuv420p');assert.equal(v.avg_frame_rate,'30/1');assert(!metadata.streams.some(s=>s.codec_type==='audio'));assert(+metadata.format.duration>=15&&+metadata.format.duration<=20);assert(statSync(path).size<50_000_000);
  const first=execFileSync('ffmpeg',['-v','error','-i',path,'-frames:v','1','-vf','scale=96:96','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);
  const cover=execFileSync('ffmpeg',['-v','error','-i',`promo/crazygames/covers/grid-pulse-${name}.png`,'-frames:v','1','-vf','scale=96:96','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);
  const coverError=first.reduce((sum,n,i)=>sum+Math.abs(n-cover[i]),0)/first.length;assert(coverError<15,'Opening frame must visually match the cover');
  const samples=[];for(const time of [2,6,10,14,17])samples.push(execFileSync('ffmpeg',['-v','error','-ss',String(time),'-i',path,'-frames:v','1','-vf','scale=96:54','-pix_fmt','rgb24','-f','rawvideo','pipe:1']));
  for(let i=1;i<samples.length;i++)assert(!samples[i].equals(samples[i-1]),'Gameplay frames must actually change');
  const capturePath=`artifacts/crazygames-capture/${name}.json`,prior=JSON.parse(readFileSync('promo/crazygames/capture-reports.json','utf8'));
  // Raw captures may be absent in a clean checkout; keep their small provenance reports tracked.
  let capture=prior[name];try{capture=JSON.parse(readFileSync(capturePath,'utf8'));}catch{}
  assert(capture.moves>=6);assert(capture.lines>=3);assert(capture.clearEvents>=2);assert(capture.realTime);
  report.videos.push({path,width:w,height:h,duration:+metadata.format.duration,fps:30,codec:v.codec_name,pixelFormat:v.pix_fmt,audio:false,bytes:statSync(path).size,openingCoverMeanError:coverError,capture});
}
writeFileSync('promo/crazygames/validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
