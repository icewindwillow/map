import test from 'node:test';
import assert from 'node:assert/strict';
import {supplement,orderPhotos,applyResearch,reviewIssues} from '../public/assets/photo-review-core.js';
test('supplement keeps user choices including low scores and rejected feedback',()=>{
 const project={selected:['mine'],items:[{id:'mine',locked:true,score:0,rejected:true},...Array.from({length:30},(_,i)=>({id:`candidate${i}`,score:i}))]};
 const selected=supplement(project);assert.equal(selected[0],'mine');assert.equal(selected.length,15);assert.equal(new Set(selected).size,15);
});
test('scene order is stable and retains every photo',()=>{
 const p={selected:['a','b','c','d'],items:[{id:'a',scene:'待分类'},{id:'b',scene:'生活与后勤'},{id:'c',scene:'外观与全貌'},{id:'d',scene:'外观与全貌'}]};
 assert.deepEqual(orderPhotos(p),['c','d','b','a']);assert.deepEqual(p.selected,['a','b','c','d']);
});
test('research preserves private memory and selection and requires reapproval',()=>{
 const p={placeId:'palace',selected:['a'],items:[{id:'a',locked:true,memory:'我的记忆',reviewed:true}]};
 applyResearch(p,{format:'atlas-photo-research-v1',placeId:'palace',photos:[{id:'a',title:'展品',note:'查证说明',identity:'已确认',researchUrl:'https://example.com/source',memory:'覆盖记忆',locked:false}]});
 assert.equal(p.items[0].memory,'我的记忆');assert.equal(p.items[0].locked,true);assert.equal(p.items[0].reviewed,false);assert.deepEqual(p.selected,['a']);
});
test('invalid research is rejected atomically',()=>{
 const p={placeId:'palace',items:[{id:'a',title:'原文'}]};
 assert.throws(()=>applyResearch(p,{format:'atlas-photo-research-v1',placeId:'palace',photos:[{id:'a',title:'更新'},{id:'unknown',title:'错误'}]}));assert.equal(p.items[0].title,'原文');
 assert.throws(()=>applyResearch(p,{format:'atlas-photo-research-v1',placeId:'other',photos:[]}));
});
test('unresolved identity blocks export',()=>{
 assert.ok(reviewIssues({placeId:'palace',selected:['a'],items:[{id:'a',title:'名称',note:'说明',reviewed:true,identity:'待核实'}]}).some(x=>x.includes('尚待核实')));
});
