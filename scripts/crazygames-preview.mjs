// Serve the extracted ZIP via HTTP; /offline/ additionally blocks external SDK scripts.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
const root=resolve('artifacts/crazygames-unpacked');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.json':'application/json'};
const server=createServer((req,res)=>{
  let url=new URL(req.url,'http://localhost').pathname;const offline=url.startsWith('/offline/');if(offline){url=url.slice('/offline'.length);res.setHeader('Content-Security-Policy',"script-src 'self'; object-src 'none'");}
  const path=resolve(root,'.'+decodeURIComponent(url)+(url.endsWith('/')?'index.html':''));if(!path.startsWith(root+sep)||!existsSync(path)||!statSync(path).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[extname(path)]??'text/plain');res.end(readFileSync(path));
});server.listen(4175,'127.0.0.1',()=>console.log('Extracted CrazyGames ZIP: http://127.0.0.1:4175/ (SDK failure test: /offline/)'));
