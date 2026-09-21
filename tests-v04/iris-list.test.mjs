import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMemories,mergeMemories} from '../public/assets/geo.v0.5.js';
import {validatePlace} from '../server/places.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../public/data/'+p,import.meta.url),'utf8'));
test('Iris list adds 39 unique blank places and preserves existing Fountains Abbey',()=>{
 const items=validateMemories(read('memories.json')),seed=validateMemories(read('fountains-abbey.v0.3.json'));
 assert.equal(items.length,39);assert.equal(items.filter(p=>p.region==='scotland').length,14);
 assert.equal(mergeMemories(seed,items).length,40);assert(!items.some(p=>p.id==='fountains-abbey'));
 assert.equal(seed[0].photos.length,2);assert.equal(seed[0].review.rating,5);
 for(const p of items){assert.deepEqual(p.photos,[]);assert.deepEqual(p.review,{author:'',rating:null,comment:''});assert.equal(p.date,'');assert.equal(p.description,'');if(p.coordinates)validatePlace(p,p.id);}
 assert.deepEqual(items.filter(p=>!p.coordinates).map(p=>p.id),['agatha-christie-house','queens-wardrobe-exhibition']);
 assert.equal(items.find(p=>p.id==='blenheim-palace').coordinateSource.url,'https://www.openstreetmap.org/relation/303066');
});
