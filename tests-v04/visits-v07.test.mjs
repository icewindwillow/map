import test from 'node:test';
import assert from 'node:assert/strict';
import {VISIT_DATES,normalizeVisits} from '../public/assets/visits.v0.7.js';
import {normalizeCategory} from '../public/assets/categories.v0.7.js';
import {validatePlace,listPlaces,SCHEMA} from '../server/places.mjs';
import {testDB} from './sqlite-adapter.mjs';
test('all 74 visits map to 73 unique places; repeat Warwick visit retained',()=>{
 assert.equal(Object.keys(VISIT_DATES).length,73);
 assert.equal(Object.values(VISIT_DATES).flat().length,74);
 assert.deepEqual(VISIT_DATES['warwick-castle'],['2026-07-19','2026-08-08']);
 assert.equal(VISIT_DATES['knaresborough-castle-viaduct'],undefined);
});
test('legacy classification and date overlay never rewrite stored text, photos, coordinates or revision',async()=>{
 const env={DB:testDB()};for(const sql of SCHEMA)await env.DB.prepare(sql).run();
 const original={id:'fountains-abbey',category:'其他',date:'',description:'原有游记\n\n第二段',coordinates:[-1.58,54.1],photos:[{src:'/api/photos/b3d4f24b-7214-440d-96e8-0572e3549fca'}],review:{author:'谢曼殊',rating:5,comment:'原有长短评绝不截断'.repeat(50)}};
 const json=JSON.stringify(original);
 env.DB.raw.prepare('INSERT INTO map_places VALUES (?,?,?,7,?,?)').run(original.id,json,json,'2026-09-21','test@example.test');
 const published=(await listPlaces(env))[0],privateRecord=(await listPlaces(env,true))[0];
 assert.equal(published.category,'修道院');assert.equal(published.date,'2026-08-19');
 for(const key of ['description','review','photos','coordinates'])assert.deepEqual(published[key],original[key]);
 assert.equal(privateRecord.revision,7);assert.deepEqual(privateRecord.draft,published);
 assert.equal(env.DB.raw.prepare('SELECT published FROM map_places').get().published,json);
 assert.equal(normalizeCategory({...original,category:'教堂'}).category,'教堂');
 assert.deepEqual(normalizeVisits({...original,visitDates:[],date:''}).visitDates,[]);
});
test('roundtrip long review and visit dates; malformed dates rejected',()=>{
 const input={id:'warwick-castle',place:'华威城堡',region:'england',category:'城堡',coordinates:[-1.58,52.28],date:'2026-07-19',visitDates:['2026-07-19','2026-08-08'],photos:[],description:'一段游记\n\n另一段。'.repeat(300),review:{author:'谢曼殊',rating:5,comment:'值得重访'}};
 const output=validatePlace(input,input.id);assert.equal(output.description,input.description);assert.deepEqual(output.visitDates,input.visitDates);assert.deepEqual(output.review,input.review);
 for(const visitDates of [['2026-02-30'],['20260808'],[7],'2026-08-08'])assert.throws(()=>validatePlace({...input,visitDates},input.id));
});
