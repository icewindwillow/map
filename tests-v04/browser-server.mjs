/** LOCAL TEST HARNESS ONLY. Never deploy this file. Binds to 127.0.0.1.
 * Uses signed fixture JWTs + SQLite + conspicuously labelled test tiles.
 * Production functions contain none of these fixture hooks.
 */
import http from 'node:http';import path from 'node:path';import {readFile,stat} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {testAuth,envBase} from './auth-fixtures.mjs';import {testDB} from './sqlite-adapter.mjs';
import {onRequest as authorRoute} from '../functions/author/[[path]].js';
import {onRequest as healthRoute} from '../functions/api/health.js';
import {onRequest as mapsRoute} from '../functions/api/maps.js';
import {onRequest as reviewsRoute} from '../functions/api/reviews.js';
import {onRequest as placesRoute} from '../functions/api/places.js';
import {onRequest as photosRoute} from '../functions/api/photos/[id].js';
import {serveTile} from '../server/tiles.mjs';import {SECURITY_HEADERS} from '../server/http.mjs';
const auth=await testAuth(),jwt=await auth.token(),db=testDB();
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>String(url).startsWith('https://photon.komoot.io/api/')?Response.json({features:[{geometry:{type:'Point',coordinates:[-3.2004184,55.9486884]},properties:{name:'Edinburgh Castle',countrycode:'GB',state:'Scotland',city:'Edinburgh',osm_type:'W',osm_id:4301292}}]}):String(url).includes('local-test-team.cloudflareaccess.com/cdn-cgi/access/certs')?auth.fetcher(url,options):originalFetch(url,options);
const root=fileURLToPath(new URL('../public/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
async function assets(request){let pathname=decodeURIComponent(new URL(request.url).pathname);let file=path.resolve(root,'.'+pathname);if((file!==path.resolve(root)&&!file.startsWith(root))||pathname.includes('..'))return new Response('not found',{status:404});try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');const bytes=await readFile(file);return new Response(bytes,{headers:{...SECURITY_HEADERS,'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}});}catch{return new Response('not found',{status:404});}}
const env={...envBase,DB:db,ASSETS:{fetch:assets}};
const png=await readFile(new URL('./fixtures/tile.png',import.meta.url));
http.createServer(async(req,res)=>{
 try{
  const parts=[];for await(const part of req)parts.push(part);
  const headers=new Headers(req.headers);const target=envBase.AUTHOR_ORIGIN+req.url;
  if(headers.get('Origin')?.startsWith('http://127.0.0.1:'))headers.set('Origin',envBase.AUTHOR_ORIGIN);
  if(headers.get('Referer')?.startsWith('http://127.0.0.1:'))headers.set('Referer',envBase.AUTHOR_ORIGIN+'/');
  if(headers.get('Cookie')?.includes('atlas_fixture_author=1'))headers.set('Cf-Access-Jwt-Assertion',jwt);
  const request=new Request(target,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(parts)});
  const context={request,env,waitUntil:p=>p.catch(()=>{})};const pathname=new URL(target).pathname;
  let response;
  if(pathname==='/api/health')response=await healthRoute(context);
  else if(pathname==='/api/maps')response=await mapsRoute(context);
  else if(pathname==='/api/reviews')response=await reviewsRoute(context);
  else if(pathname==='/api/places')response=await placesRoute(context);
  else if(pathname.startsWith('/api/photos/'))response=await photosRoute({...context,params:{id:pathname.split('/').at(-1)}});
  else if(pathname.startsWith('/api/tiles/'))response=await serveTile(context,{cache:null,fetcher:async()=>new Response(png,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=604800'}})});
  else if(pathname==='/author'||pathname.startsWith('/author/'))response=await authorRoute(context);
  else response=await assets(request);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500).end('Test harness error');}
}).listen(8794,'127.0.0.1',()=>console.log('LOCAL TEST HARNESS http://127.0.0.1:8794 — mock tiles, fixture auth, local SQLite'));
