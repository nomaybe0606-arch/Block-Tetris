import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve,relative,sep,extname} from 'node:path';
import {createServer} from 'node:http';
const root=resolve('dist-crazygames');
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=walk(root),bytes=files.reduce((n,f)=>n+statSync(f).size,0),html=readFileSync(join(root,'index.html'),'utf8');
assert(files.length<=1500);assert(bytes<=50_000_000);assert(bytes<20_000_000,'Keep all local files below the mobile initial-load target');
assert(html.includes('<title>Grid Pulse</title>'));
for(const [,url] of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert(url.startsWith('./'),url);assert(existsSync(join(root,url)),url);}
const scripts=files.filter(f=>f.endsWith('.js')),code=scripts.filter(f=>!f.includes('phaser-')).map(f=>readFileSync(f,'utf8')).join('\n');
for(const marker of ['crazygames-sdk-v3.js','gameplayStart','gameplayStop','loadingStop'])assert(code.includes(marker),marker);
assert(!/playgama|VKWebApp|PkbSDK|games\.pikabu|GRID_PULSE_DEV|GRID_TETRIS_RENDER|PromoCapture|promoCapture|qa=|requestAd|showRewarded\("|fullscreen/i.test(code),'Other hosts, ads, fullscreen or DEV code leaked');
assert(!files.some(f=>/\.(zip|ts|mp4|webm)$|playgama|vk-bridge|promo[\\/]/i.test(relative(root,f))));
assert(code.includes('./assets/audio/'),'Relative audio paths');
for(const f of scripts)for(const [,url] of readFileSync(f,'utf8').matchAll(/["'`]((?:\.\/|\.\.\/)[^"'`\s]+\.(?:js|css))["'`]/g))assert(existsSync(resolve(f,'..',url))||existsSync(resolve(root,url)),url);
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+sep)||!existsSync(path)||!statSync(path).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[extname(path)]??'text/plain');res.end(readFileSync(path));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
try{for(const file of files){const url=relative(root,file).split(sep).join('/'),r=await fetch(base+'/'+url);assert.equal(r.status,200,url);assert(Buffer.from(await r.arrayBuffer()).equals(readFileSync(file)),url);if(/\.(ogg|mp3)$/.test(file))assert(r.headers.get('content-type').startsWith('audio/'));}}finally{await new Promise(resolve=>server.close(resolve));}
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/crazygames-build-metrics.json',JSON.stringify({files:files.length,uncompressedBytes:bytes,allLocalFilesMiB:bytes/1024/1024,initialLoadUpperBoundLocalBytes:bytes,sdk:'external official v3; CDN size is additional',httpFilesChecked:files.length},null,2));
console.log(`CrazyGames verified over HTTP: ${files.length} files, ${bytes} bytes (${(bytes/1024/1024).toFixed(2)} MiB), Basic Launch, relative paths.`);
