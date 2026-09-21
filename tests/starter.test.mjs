import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {UK_BOUNDS,project,unproject,validateMemories,filterMemories,clusterPoints} from '../public/assets/geo.v0.3.js';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const read=name=>readFile(path.join(root,name),'utf8');
const data=JSON.parse(await read('data/demos.json'));
test('homepage has locale, responsive viewport and correct title',async()=>{
 const html=await read('index.html');assert.match(html,/lang="zh-CN"/);assert.match(html,/name="viewport"/);assert.match(html,/<title>谢老师的英国旅行 · 记忆地图<\/title>/);
});
test('all local homepage assets exist',async()=>{
 const html=await read('index.html');for(const m of html.matchAll(/(?:src|href)="(\.\/assets\/[^"#]+)"/g))assert.ok((await stat(path.join(root,m[1]))).isFile());
});
test('no duplicate element IDs',async()=>{const ids=[...(await read('index.html')).matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);});
test('saved stories have a valid schema before and after publishing',async()=>{const d=JSON.parse(await read('data/memories.json'));assert.equal(d.schemaVersion,1);assert.doesNotThrow(()=>validateMemories(d));});
test('eight demo items are clearly segregated',()=>{const d=validateMemories(data,true);assert.equal(d.length,8);assert.ok(d.every(m=>m.demo));assert.deepEqual(new Set(d.map(m=>m.region)),new Set(['england','scotland','wales','northernIreland']));});
test('Mercator projection round-trips each demo coordinate',()=>{for(const m of data.memories){const r=unproject(project(m.coordinates));assert.ok(Math.abs(r[0]-m.coordinates[0])<1e-10);assert.ok(Math.abs(r[1]-m.coordinates[1])<1e-10);}});
test('UK opening extent includes Shetland and Northern Ireland',()=>{assert.ok(UK_BOUNDS[3]>60.86);assert.ok(UK_BOUNDS[0]<-8.2);assert.ok(UK_BOUNDS[1]<50);assert.ok(UK_BOUNDS[2]>1.8);});
test('bundled geometry includes high northern islands, provenance and license',async()=>{const g=JSON.parse(await read('data/uk-overview.geojson'));assert.equal(g.type,'FeatureCollection');assert.ok(g.features.length>700);assert.match(g.metadata.license,/LGPL/);const vertices=g.features.filter(f=>f.properties.kind==='land').flatMap(f=>f.geometry.coordinates[0]);assert.ok(vertices.some(([x,y])=>x>-2&&x<0&&y>60.8&&y<61));assert.ok((await stat(path.join(root,'data/licenses/COPYING.LESSER'))).size>0);});
test('validation rejects duplicate ids and invalid coordinates',()=>{assert.throws(()=>validateMemories({...data,memories:[data.memories[0],data.memories[0]]}));assert.throws(()=>validateMemories({schemaVersion:1,memories:[{id:'bad',title:'test',coordinates:[51,'bad']}]}));});
test('legacy stories without coordinates remain readable',()=>{const [m]=validateMemories({schemaVersion:1,memories:[{id:'old',title:'文字',place:'伦敦',description:'保留原有内容'}]});assert.equal(m.description,'保留原有内容');assert.equal(m.coordinates,undefined);});
test('real records cannot masquerade as demos',()=>{const [m]=validateMemories({schemaVersion:1,memories:[{id:'real',title:'test',demo:true}]});assert.equal(m.demo,false);});
test('search matches English, Chinese and regions',()=>{const d=validateMemories(data,true);assert.equal(filterMemories(d,'all','london').length,1);assert.equal(filterMemories(d,'all','伦敦').length,1);assert.equal(filterMemories(d,'scotland').length,2);assert.equal(filterMemories(d,'wales','London').length,0);});
test('cluster merging does not change original geographic coordinates',()=>{const items=[{id:'a',coordinates:[0,0]},{id:'b',coordinates:[1,1]}];const snapshot=JSON.stringify(items);assert.equal(clusterPoints(items,p=>p,10).length,1);assert.equal(JSON.stringify(items),snapshot);assert.equal(clusterPoints(items,p=>p.map(v=>v*100),10).length,2);});
test('runtime renders user text without innerHTML',async()=>{assert.doesNotMatch(await read('assets/app.v0.3.js'),/\.innerHTML\s*=/);});
test('default page makes no external script requests',async()=>{assert.doesNotMatch(await read('index.html'),/<script[^>]+src="https?:/);});
test('CSP allows optional map tiles and blob workers while protecting the site',async()=>{const h=await read('_headers');assert.match(h,/worker-src 'self' blob:/);assert.match(h,/connect-src 'self' https:\/\/tiles.openfreemap.org/);assert.match(h,/X-Robots-Tag: noindex/);assert.match(h,/frame-ancestors 'none'/);});
