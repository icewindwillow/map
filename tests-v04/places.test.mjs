import test from 'node:test';
import assert from 'node:assert/strict';
import {testDB} from './sqlite-adapter.mjs';
import {listPlaces,mutatePlace,uploadPhoto,readPhoto,validatePlace} from '../server/places.mjs';
import {sortMemories} from '../public/assets/collection.v0.5.js';
import {validateMemories} from '../public/assets/geo.v0.5.js';
const author={email:'test@example.test'};
const place=(id='new-place')=>({id,place:'新地点',title:'新地点',region:'scotland',coordinates:[-3.2,55.95],photos:[],review:{author:'作者',rating:4.5,comment:'感受'}});
test('empty additive schema reads without altering original reviews',async()=>{const env={DB:testDB()};assert.deepEqual(await listPlaces(env),[]);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM author_reviews').get().n,1);});
test('multiple places: private draft, publish, concurrent conflict, discard and preservation',async()=>{
  const env={DB:testDB()};const p=place();
  let r=await mutatePlace(env,{id:p.id,revision:0,action:'draft',place:p},author);
  assert.equal(r.revision,1);assert.deepEqual(await listPlaces(env),[]);assert.equal((await listPlaces(env,true))[0].draft.place,'新地点');
  await assert.rejects(()=>mutatePlace(env,{id:p.id,revision:0,action:'publish',place:p},author),e=>e.status===409);
  r=await mutatePlace(env,{id:p.id,revision:1,action:'publish',place:p},author);
  assert.equal((await listPlaces(env))[0].review.rating,4.5);assert.equal(r.draft,null);
  await mutatePlace(env,{id:'second',revision:0,action:'publish',place:place('second')},author);
  const changed={...p,place:'私有草稿'};
  r=await mutatePlace(env,{id:p.id,revision:r.revision,action:'draft',place:changed},author);
  assert.equal((await listPlaces(env)).length,2);assert.equal((await listPlaces(env)).find(x=>x.id===p.id).place,'新地点');
  await mutatePlace(env,{id:p.id,revision:r.revision,action:'discard-draft'},author);
  assert.equal((await listPlaces(env,true)).find(x=>x.id===p.id).draft,null);
  assert.equal(env.DB.raw.prepare('SELECT published_comment FROM author_reviews').get().published_comment,'破旧的修道院比完整的好看多了！');
});
test('photo upload private until referenced by a published record, removal revokes public read',async()=>{
  const env={DB:testDB()};const photo=await uploadPhoto(env,{data:'data:image/jpeg;base64,/9j/2Q=='}),id=photo.src.split('/').at(-1);
  assert.equal((await readPhoto(env,id,true)).status,200);
  await assert.rejects(()=>readPhoto(env,id),e=>e.status===404);
  const p={...place(),photos:[photo]};let r=await mutatePlace(env,{id:p.id,revision:0,action:'draft',place:p},author);
  await assert.rejects(()=>readPhoto(env,id),e=>e.status===404);
  r=await mutatePlace(env,{id:p.id,revision:r.revision,action:'publish',place:p},author);
  assert.equal((await readPhoto(env,id)).headers.get('Content-Type'),'image/jpeg');
  assert.equal(validateMemories({schemaVersion:1,memories:await listPlaces(env)})[0].photos[0].src,photo.src);
  await mutatePlace(env,{id:p.id,revision:r.revision,action:'publish',place:{...p,photos:[]}},author);
  await assert.rejects(()=>readPhoto(env,id),e=>e.status===404);
});
test('reject invalid fields, unsafe photo URLs, excessive uploads and nonexistent photo references',async()=>{
  for(const change of [{place:''},{region:'unknown'},{coordinates:[181,50]},{coordinates:['-3',55]},{date:'2026-02-30'},{photos:[{src:'javascript:alert(1)'}]},{photos:[{src:'./assets/../evil.jpg'}]},{review:{author:'a',rating:1.2,comment:''}}])assert.throws(()=>validatePlace({...place(),...change},'new-place'),e=>e.status===400);
  const env={DB:testDB()};
  await assert.rejects(()=>uploadPhoto(env,{data:'data:image/svg+xml;base64,PHN2Zz4='}));
  await assert.rejects(()=>uploadPhoto(env,{data:'data:image/jpeg;base64,'+Buffer.alloc(210*1024).toString('base64')}));
  await assert.rejects(()=>mutatePlace(env,{id:'new-place',revision:0,action:'publish',place:{...place(),photos:[{src:'/api/photos/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}]}},author));
});
test('star ordering stable with half stars, zero, unrated last, and no mutation',()=>{
  const items=[null,0,4.5,5,4.5,undefined].map((rating,i)=>({id:i,review:{rating}}));
  assert.deepEqual(sortMemories(items,'rating-desc').map(x=>x.id),[3,2,4,1,0,5]);
  assert.deepEqual(sortMemories(items,'rating-asc').map(x=>x.id),[1,2,4,3,0,5]);
  assert.deepEqual(items.map(x=>x.id),[0,1,2,3,4,5]);assert.deepEqual(sortMemories(items),items);
});
