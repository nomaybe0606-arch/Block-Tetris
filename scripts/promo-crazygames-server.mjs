// Local-only capture receiver, independent of every production Vite build.
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
const receiver={name:'local-promo-capture',configureServer(server){server.middlewares.use(async(req,res,next)=>{
  const match=/^\/__promo\/(landscape|portrait)\.(webm|json)$/.exec(req.url??'');if(!match)return next();
  if(req.method!=='POST'||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&!/^http:\/\/(127\.0\.0\.1|localhost):5174$/.test(req.headers.origin))){res.writeHead(403).end();return;}
  try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>64_000_000)throw Error('Capture too large');chunks.push(chunk);}mkdirSync('artifacts/crazygames-capture',{recursive:true});writeFileSync(`artifacts/crazygames-capture/${match[1]}.${match[2]}`,Buffer.concat(chunks));res.end('saved');}catch{res.writeHead(400).end();}
});}};
const server=await createServer({plugins:[receiver],server:{host:'127.0.0.1',port:5174,strictPort:true},mode:'crazygames'});
await server.listen();console.log('Capture real gameplay: http://127.0.0.1:5174/promo.html');
