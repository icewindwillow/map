import test from 'node:test';
import assert from 'node:assert/strict';
import {testDB} from './sqlite-adapter.mjs';
import {addVisitor,visitorList,deleteVisitor} from '../server/visitors.mjs';
import {validatePlace,mutatePlace} from '../server/places.mjs';
import {normalizeDetails} from '../public/assets/details.v0.8.js';
import {locations} from '../public/assets/city-seeds.v0.8.js';
const origin='https://iris.example';
const request=(ip='192.0.2.1')=>new Request(origin+'/api/guest-reviews',{headers:{Origin:origin,'CF-Connecting-IP':ip}});
const body=()=>({id:crypto.randomUUID(),place:'fountains-abbey',name:'游客名字',rating:4,comment:'<script>alert(1)</script>'});
test('visitor publish, retry, average, deletion and author data separation',async()=>{
 const env={DB:testDB()},first=body();await addVisitor(env,request(),first);await addVisitor(env,request(),first);
 let data=await visitorList(env,first.place);assert.equal(data.summary.count,1);assert.equal(data.summary.average,4);assert.equal(data.reviews[0].comment,first.comment);
 await addVisitor(env,request('192.0.2.2'),{...body(),rating:2});assert.equal((await visitorList(env,first.place)).summary.average,3);
 await deleteVisitor(env,{id:first.id},{email:'author@example.test'});data=await visitorList(env,first.place);assert.equal(data.summary.count,1);assert.equal(data.summary.average,2);
 await assert.rejects(addVisitor(env,request(),first),e=>e.status===409);
 assert.equal(env.DB.raw.prepare('SELECT published_comment FROM author_reviews').get().published_comment,'破旧的修道院比完整的好看多了！');
 assert(!JSON.stringify(data).includes('deleted_by'));
});
test('visitor inputs, origin, unpublished places and rate limit fail closed',async()=>{
 const env={DB:testDB()};
 for(const patch of [{rating:0},{rating:5.5},{name:''},{comment:'a'.repeat(2001)},{website:'bot'}])await assert.rejects(addVisitor(env,request(),{...body(),...patch}),e=>e.status===400);
 await assert.rejects(addVisitor(env,new Request(origin),body()),e=>e.status===403);
 await assert.rejects(addVisitor(env,request(),{...body(),place:'private-draft'}),e=>e.status===404);
 await addVisitor(env,request(),body());await assert.rejects(addVisitor(env,request(),body()),e=>e.status===429);
});
test('visitor pagination has no duplicates or deleted records',async()=>{
 const env={DB:testDB()};for(let i=0;i<23;i++)await addVisitor(env,request(`192.0.2.${i}`),body());
 const one=await visitorList(env,'fountains-abbey'),two=await visitorList(env,'fountains-abbey',one.next);assert.equal(one.reviews.length,20);assert.equal(two.reviews.length,3);assert.equal(new Set([...one.reviews,...two.reviews].map(r=>r.id)).size,23);assert.equal(two.next,null);
});
test('official introduction and city roundtrip separately from author long review',async()=>{
 const p={id:'fountains-abbey',place:'修道院',region:'england',coordinates:[-1.58,54.1],city:'里彭',officialIntroduction:'官方背景\n第二段',officialSource:'https://example.com/history',description:'自己的长评',review:{author:'谢曼殊',rating:5,comment:'短评'},photos:[]};
 const valid=validatePlace(p,p.id);assert.equal(valid.officialIntroduction,p.officialIntroduction);assert.equal(valid.description,p.description);
 const env={DB:testDB()};const row=await mutatePlace(env,{id:p.id,revision:0,action:'publish',place:p},{email:'author@example.test'});assert.equal(row.published.city,'里彭');
 assert.throws(()=>validatePlace({...p,officialSource:'javascript:alert(1)'},p.id));
 for(const [id,locationLabel]of Object.entries(locations)){const normalized=normalizeDetails({id,locationLabel});if(id!=='agatha-christie-house')assert(normalized.city,`Missing city: ${id}`);}
 assert.equal(normalizeDetails({id:'fountains-abbey',city:'作者修改'}).city,'作者修改');
});
