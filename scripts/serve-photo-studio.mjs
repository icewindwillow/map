// Local, read-only review preview. No credentials, write API or production requests.
import http from 'node:http';
import path from 'node:path';
import {readFile,realpath,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=await realpath(fileURLToPath(new URL('../public/',import.meta.url)));
const manifest=process.argv[2]?path.resolve(process.argv[2]):null;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const port=Number(process.env.PHOTO_STUDIO_PORT||8795);
const within=f=>f===root||f.startsWith(root+path.sep);
http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'){res.writeHead(405).end();return;}
    const url=new URL(req.url,'http://127.0.0.1');let data,type;
    if(url.pathname==='/local-review/manifest.json'&&manifest){data=await readFile(manifest);type=types['.json'];}
    else{let name=decodeURIComponent(url.pathname);if(name.split('/').some(x=>x.startsWith('.')||x.startsWith('_'))||name.includes('\0'))throw Error('Not found');let target=path.resolve(root,'.'+name);if(!within(target))throw Error('Not found');let f=await realpath(target);if(!within(f))throw Error('Not found');if((await stat(f)).isDirectory())f=await realpath(path.join(f,'index.html'));if(!within(f))throw Error('Not found');data=await readFile(f);type=types[path.extname(f)]||'application/octet-stream';}
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});res.end(data);
  }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`照片审核台：http://127.0.0.1:${port}/photo-studio/`));
