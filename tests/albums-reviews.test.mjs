import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {validateMemories,validRating,starFills,photosOf,mergeMemories,publishableMemories,filterMemories,safePhotoPath} from '../public/assets/geo.v0.3.js';
const publicRoot=new URL('../public/',import.meta.url);
const seed=JSON.parse(await readFile(new URL('data/fountains-abbey.v0.3.json',publicRoot),'utf8'));
const first=validateMemories(seed)[0];
const make=m=>({schemaVersion:1,memories:[{id:'test',title:'测试',...m}]});
test('first real record preserves the supplied comment and five-star rating',()=>{
 assert.equal(seed.memories.length,1);assert.equal(first.demo,false);assert.equal(first.review.comment,'破旧的修道院比完整的好看多了！');assert.equal(first.review.rating,5);assert.equal(first.date,'');assert.equal(first.place,'流水修道院');
});
test('both actual photos are attached to the same location and exist locally',async()=>{
 assert.equal(photosOf(first).length,2);for(const photo of first.photos){assert.ok((await stat(new URL(photo.src,publicRoot))).size>100000);assert.ok((await stat(new URL(photo.thumbnail,publicRoot))).size>0);assert.ok(photo.width>0&&photo.height>0);}
});
test('pin uses the official site reference, not invented camera GPS',()=>{
 assert.deepEqual(first.coordinates,[-1.58033,54.1096]);assert.match(first.locationPrecision,/不是照片拍摄点/);assert.match(first.coordinateSource.url,/nationaltrust.org.uk/);
});
test('all eleven half-star values from zero through five are valid',()=>{
 for(let n=0;n<=10;n++){const rating=n/2;assert.ok(validRating(rating));assert.doesNotThrow(()=>validateMemories(make({review:{rating}})));assert.equal(starFills(rating).reduce((a,b)=>a+b),rating);}
});
test('zero stars are different from missing or null ratings',()=>{
 assert.ok(validRating(0));assert.equal(validRating(null),false);assert.equal(validRating(undefined),false);assert.doesNotThrow(()=>validateMemories(make({review:{rating:null}})));assert.deepEqual(starFills(0),[0,0,0,0,0]);
});
test('half-filled fifth star and half-filled first star render precisely',()=>{
 assert.deepEqual(starFills(4.5),[1,1,1,1,.5]);assert.deepEqual(starFills(.5),[.5,0,0,0,0]);
});
test('invalid rating types, fractions and ranges are rejected without rounding',()=>{
 for(const rating of ['5',-1,5.5,NaN,Infinity,4.7]){assert.equal(validRating(rating),false);assert.throws(()=>validateMemories(make({review:{rating}})));}
});
test('single-photo legacy records remain usable',()=>{
 const [m]=validateMemories(make({photo:'./assets/a.jpg',photoAlt:'之前的照片'}));assert.deepEqual(photosOf(m),[{src:'./assets/a.jpg',alt:'之前的照片',caption:''}]);
});
test('no-photo records and explicit empty albums do not create fake photographs',()=>{
 assert.deepEqual(photosOf({}),[]);assert.deepEqual(photosOf({photos:[],photo:'./assets/a.jpg'}),[]);
});
test('unsafe photo paths and encoded traversal are refused',()=>{
 for(const src of ['https://remote.test/x.jpg','javascript:alert(1)','./assets/../../x.jpg','./assets/%2e%2e/x.jpg','./assets/%252e%252e/x.jpg','./assets/a.jpg?x=1']){assert.equal(safePhotoPath(src),false);assert.throws(()=>validateMemories(make({photos:[{src}]})));}
 assert.ok(safePhotoPath('./assets/photos/a.v0.3.jpg'));
});
test('saved author records override the starter without duplicating a pin',()=>{
 const saved={...first,review:{rating:4.5,comment:'改后的评论'}};const extra={id:'elsewhere',title:'另一个地点'};
 const result=mergeMemories([first],[saved,extra]);assert.equal(result.length,2);assert.equal(result[0].review.rating,4.5);assert.equal(result[0].photos.length,2);assert.equal(result[1].id,'elsewhere');assert.equal(first.review.rating,5);
});
test('export retains coordinates, all photos, author data and unknown future fields',()=>{
 const m={...first,notesForLater:{one:true}};const out=publishableMemories([m,{id:'demo',title:'demo',demo:true}]);assert.equal(out.memories.length,1);assert.equal(out.memories[0].demo,undefined);assert.deepEqual(out.memories[0].photos,first.photos);assert.deepEqual(out.memories[0].notesForLater,{one:true});assert.doesNotThrow(()=>validateMemories(out));
});
test('search matches author review, alternate names and nearby city',()=>{
 for(const query of ['破旧','Fountains','Ripon','喷泉修道院','北约克郡'])assert.equal(filterMemories([first],'all',query).length,1);
});
test('photo and review metadata types are checked before rendering',()=>{
 for(const fields of [{photos:'x'},{photos:[{src:'./assets/a.jpg',caption:3}]},{review:[]},{review:{comment:99}},{photos:[{src:'./assets/a.jpg',width:-1}]}])assert.throws(()=>validateMemories(make(fields)));
});
test('author publishing is explicit export, never a public write endpoint',async()=>{
 const html=await readFile(new URL('index.html',publicRoot),'utf8');const app=await readFile(new URL('assets/app.v0.3.js',publicRoot),'utf8');
 assert.match(html,/不会直接修改线上内容/);assert.match(html,/min="0" max="5" step="0.5"/);assert.match(app,/a.download='memories.json'/);assert.doesNotMatch(app,/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i);assert.doesNotMatch(app,/\.innerHTML\s*=/);
});
