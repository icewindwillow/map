import test from 'node:test';
import assert from 'node:assert/strict';
import {recommend,move,reviewIssues,assertPackage} from '../public/assets/photo-review-core.js';
import {installPhotoReviewImport} from '../public/assets/photo-review-import.js';
test('selection respects limit, rejection, duplicate hashes and scene groups',()=>{
 const items=Array.from({length:30},(_,i)=>({id:String(i),score:100-i,group:String(i)}));items[0].rejected=true;items[1].hash='0'.repeat(64);items[2].hash='0'.repeat(64);items[3].group=items[4].group;
 const ids=recommend(items);assert.equal(ids.length,15);assert(!ids.includes('0'));assert(!ids.includes('2'));assert(!ids.includes('4'));
});
test('editor import checks location and changes only photos after all uploads succeed',async()=>{
 const originalDocument=globalThis.document,originalConfirm=globalThis.confirm;
 const p={format:'atlas-photo-review-v1',placeId:'britannia',approved:true,photos:Array.from({length:2},()=>({caption:'驾驶台：舵轮。',reviewed:true,data:'data:image/jpeg;base64,/9j/2Q=='}))};
 let handler,uploads=0,backups=0,photos=['original'],messages=[];const input={files:[new File([JSON.stringify(p)],'approved.json')],addEventListener:(name,fn)=>handler=fn};
 globalThis.document={getElementById:()=>input};globalThis.confirm=()=>true;
 let id='different',fail=false;
 try{
 installPhotoReviewImport({getPlaceId:()=>id,isAvailable:()=>true,setPhotos:p=>photos=p,api:async()=>{uploads++;if(fail&&uploads===2)throw Error('offline');return {photo:{src:'/api/photos/test'}};},compress:async()=>({data:p.photos[0].data,width:100,height:80}),lock:()=>{},message:m=>messages.push(m),backup:()=>backups++});
 await handler();assert.equal(uploads,0);assert.equal(backups,0);assert.deepEqual(photos,['original']);
 id='britannia';fail=true;await handler();assert.equal(uploads,2);assert.deepEqual(photos,['original']);assert(messages.at(-1).includes('原相册仍保留'));
 uploads=0;fail=false;await handler();assert.equal(uploads,2);assert.equal(photos.length,2);assert.equal(photos[0].caption,'驾驶台：舵轮。');assert.equal(backups,2);
 }finally{globalThis.document=originalDocument;globalThis.confirm=originalConfirm;}
});
test('reorder stays immutable and boundaries do not drop photos',()=>{const ids=['a','b','c'];assert.deepEqual(move(ids,0,2),['b','c','a']);assert.deepEqual(ids,['a','b','c']);assert.deepEqual(move(ids,0,-1),ids);});
test('review requires exact IDs, unique images, captions and individual approvals',()=>{
 const project={placeId:'royal-yacht-britannia',selected:['a'],items:[{id:'a',title:'驾驶台',note:'舵轮与仪表。',reviewed:true}]};assert.deepEqual(reviewIssues(project),[]);project.items[0].reviewed=false;assert(reviewIssues(project).length);project.items[0].reviewed=true;project.selected=['a','a'];assert(reviewIssues(project).length);
});
test('publication package rejects external image payloads, malformed captions and unsafe sources',()=>{
 const p={format:'atlas-photo-review-v1',placeId:'royal-yacht-britannia',approved:true,photos:[{caption:'驾驶台：舵轮与仪表。',reviewed:true,data:'data:image/jpeg;base64,/9j/2Q=='}]};assertPackage(p);
 for(const patch of [{data:'https://example.com/photo.jpg'},{reviewed:false},{caption:''},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://name:password@example.com'}])assert.throws(()=>assertPackage({...p,photos:[{...p.photos[0],...patch}]}));
 assert.throws(()=>assertPackage({...p,photos:Array(16).fill(p.photos[0])}));assert.throws(()=>assertPackage({...p,approved:false}));
});
