import {worldPoint} from './streets.v0.4.js';
const $=id=>document.getElementById(id),report={page:'v0.4',origin:location.origin};
async function read(path){const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.headers.get('Content-Type')?.includes('application/json'))throw new Error(`HTTP ${r.status}，但不是 JSON。请检查根目录 functions 是否已推送、API 是否被重定向成首页。`);const d=await r.json();if(!r.ok)throw new Error(`${d.code||r.status}：${d.message||'请求失败'}`);return d;}
async function run(){
  for(const [key,path,id]of [['health','/api/health','health-result'],['maps','/api/maps','map-result'],['reviews','/api/reviews','reviews-result']]){
    $(id).textContent='正在检查…';
    try{const d=await read(path);report[key]=key==='reviews'?{ok:d.ok,count:d.reviews.length}:d;$(id).textContent=JSON.stringify(report[key],null,2);}catch(e){report[key]={error:e.message};$(id).textContent=e.message;}
  }
}
$('test-tile').addEventListener('click',async()=>{
  $('test-tile').disabled=true;$('tile-result').textContent='正在读取实际街道图片…';$('diagnostic-tile').hidden=true;$('tile-credit').hidden=true;
  try{
    const p=worldPoint([-1.58033,54.1096],16);const path=`/api/tiles/16/${Math.floor(p[0]/256)}/${Math.floor(p[1]/256)}.png`;
    const r=await fetch(path,{signal:AbortSignal.timeout(16000),referrerPolicy:'strict-origin-when-cross-origin',credentials:'omit'});
    if(!r.ok){let d;try{d=await r.json();}catch{}throw new Error(`${d?.code||r.status}：${d?.message||'没有读取到地图'}`);}
    if(!r.headers.get('Content-Type')?.includes('image/png'))throw new Error('接口返回的不是地图 PNG 图片。');
    const blob=await r.blob(),url=URL.createObjectURL(blob);if($('diagnostic-tile').dataset.blob)URL.revokeObjectURL($('diagnostic-tile').dataset.blob);$('diagnostic-tile').dataset.blob=url;$('diagnostic-tile').src=url;await $('diagnostic-tile').decode();$('diagnostic-tile').hidden=false;$('tile-credit').hidden=false;
    report.tile={ok:true,path,bytes:blob.size};$('tile-result').textContent='已读取并显示一张真实街道图片。这验证了当前网络的一次请求，不代表所有区域永远可用。';
  }catch(e){report.tile={error:e.message};$('tile-result').textContent=e.message;}finally{$('test-tile').disabled=false;}
});
$('copy-report').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));$('copy-result').textContent='已复制，可直接发给我排查。';}catch{$('copy-result').textContent='浏览器不允许复制。请截图上方结果。';}});
$('rerun-check').addEventListener('click',run);run();
