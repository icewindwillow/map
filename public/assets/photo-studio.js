import {LIMIT,recommend,move,reviewIssues,assertPackage,supplement,orderPhotos,SCENES,applyResearch} from './photo-review-core.js?v=2';
const $=id=>document.getElementById(id);
let state={format:'atlas-photo-project-v1',place:'',placeId:'',items:[],selected:[]},mode='selected',replacement=null,busy=false,drag=null;
let pendingWrite=Promise.resolve(),saveTimer;
const dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('atlas-photo-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(writeState,350);}
async function writeState(){
  const snapshot=structuredClone(state);
  pendingWrite=pendingWrite.catch(()=>{}).then(async()=>{const db=await dbPromise;await new Promise((resolve,reject)=>{const t=db.transaction('projects','readwrite');t.objectStore('projects').put(snapshot,'current');t.oncomplete=resolve;t.onerror=()=>reject(t.error);});});
  try{await pendingWrite;}catch{status('本机自动保存失败，请点击“备份审核项目”保存文件。',true);}
}
function button(text,fn){const el=document.createElement('button');el.type='button';el.textContent=text;el.onclick=fn;return el;}
function text(tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;}
function sync(){state.place=$('place').value.trim();state.placeId=$('place-id').value.trim();persist();summary();}
function summary(){const chosen=state.selected.map(id=>state.items.find(x=>x.id===id));$('count').textContent=`${chosen.length} / ${LIMIT}`;$('progress').textContent=`已逐张审核 ${chosen.filter(x=>x?.reviewed).length} / ${chosen.length} 张`;$('export').disabled=busy||!!reviewIssues(state).length;}
function changed(){persist();render();}
function field(label,value,oninput,multi=false){const wrap=document.createElement('label');wrap.textContent=label;const el=document.createElement(multi?'textarea':'input');if(!multi)el.type='text';el.maxLength=label.includes('不公开')||label.includes('HTTPS')?2000:multi?350:100;el.value=value||'';el.oninput=()=>oninput(el.value);wrap.append(el);return wrap;}
function render(){
  summary();$('selected-tab').setAttribute('aria-pressed',mode==='selected');$('library-tab').setAttribute('aria-pressed',mode==='library');
  $('mode-hint').textContent=replacement!==null?`正在替换第 ${replacement+1} 张：请选择新的照片，名称和备注随新照片一起更换。`:'点照片查看完整画面；入选卡片可拖动排序，也可点击前移／后移。';
  const query=$('search').value.toLowerCase();const list=(mode==='selected'?state.selected.map(id=>state.items.find(x=>x.id===id)):state.items).filter(Boolean).filter(x=>[x.title,x.filename,x.note,x.feedback,x.memory,x.scene].join(' ').toLowerCase().includes(query));
  $('grid').replaceChildren();if(!list.length)$('grid').append(text('p','这里还没有照片。选择一个照片文件夹，或加载 Britannia 示例。','empty'));
  for(const p of list){
    const index=state.selected.indexOf(p.id),card=document.createElement('article');card.className='card'+(p.reviewed?' checked':'');card.dataset.id=p.id;card.draggable=mode==='selected';
    card.ondragstart=e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();return;}drag=p.id;};card.ondragover=e=>e.preventDefault();card.ondrop=e=>{e.preventDefault();if(drag&&mode==='selected'){state.selected=move(state.selected,state.selected.indexOf(drag),index);changed();}drag=null;};
    const photo=button('',()=>{ $('large').src=p.data;$('large-caption').textContent=[p.title,p.note,p.filename].filter(Boolean).join(' · ');$('lightbox').showModal();});photo.className='photo';const img=new Image();img.src=p.thumbnail||p.data;img.alt=p.title||p.filename;img.loading='lazy';photo.append(img);if(index>=0)photo.append(text('span',String(index+1).padStart(2,'0'),'number'));card.append(photo);
    const body=document.createElement('div');body.className='card-body';body.append(text('p',`${p.filename} · ${p.width} × ${p.height}`,'meta'));
    body.append(text('p',p.score==null?'人工场景推荐 · 技术分未计算':`技术参考 ${p.score}/100 · 不含游客与事实判断`,'meta'));
    if(p.reason)body.append(text('p',p.reason,'meta'));
    const check=document.createElement('input');check.type='checkbox';check.checked=!!p.reviewed;
    function edit(key,v){p[key]=v;p.reviewed=false;check.checked=false;card.classList.remove('checked');persist();summary();}
    body.append(field('名称',p.title,v=>edit('title',v)),field('简短注释',p.note,v=>edit('note',v),true));
    const keep=document.createElement('label');keep.className='approve';const lock=document.createElement('input');lock.type='checkbox';lock.checked=!!p.locked;lock.onchange=()=>{p.locked=lock.checked;persist();};keep.append(lock,document.createTextNode('我的精选 · 补选时保留'));body.append(keep);
    const context=document.createElement('details');context.append(text('summary','我的记忆、场景与查证'));
    context.append(field('我的记忆／为什么选它（不公开）',p.memory,v=>{p.memory=v;persist();},true));
    function choice(label,values,key){const wrap=document.createElement('label');wrap.textContent=label;const select=document.createElement('select');for(const value of values)select.add(new Option(value,value));select.value=p[key]||values[0];select.onchange=()=>edit(key,select.value);wrap.append(select);return wrap;}
    context.append(choice('场景类别',SCENES,'scene'),choice('辨认状态',['待核实','已确认','仅描述可见画面'],'identity'));
    context.append(field('查证结论与依据（不公开）',p.evidence,v=>edit('evidence',v),true),field('查证资料网页 HTTPS 链接（不公开）',p.researchUrl,v=>edit('researchUrl',v)));
    context.append(text('p','简介写清具体对象与独特之处。无法辨认时选“仅描述可见画面”，避免加入未核实身份或历史。','meta'));body.append(context);
    const source=document.createElement('details');source.append(text('summary','图片来源（网图请保留）'));source.append(field('摄影者／来源',p.credit,v=>edit('credit',v)),field('来源网页 HTTPS 链接',p.sourceUrl,v=>edit('sourceUrl',v)));body.append(source);
    const actions=document.createElement('div');actions.className='actions';
    if(index>=0){actions.append(button('换一张',()=>{if(p.locked&&!confirm('这是你的精选照片。确定主动替换它吗？'))return;replacement=index;mode='library';$('search').value='';render();$('grid').scrollIntoView();}),button('前移',()=>{state.selected=move(state.selected,index,index-1);changed();}),button('后移',()=>{state.selected=move(state.selected,index,index+1);changed();}),button('移出入选',()=>{if(p.locked&&!confirm('这是你的精选照片。确定移出入选吗？'))return;state.selected.splice(index,1);p.locked=false;replacement=null;changed();}));}
    else actions.append(button(replacement!==null?'替换到此位置':'加入相册',()=>{if(replacement!==null){const previous=state.items.find(x=>x.id===state.selected[replacement]);if(previous)previous.locked=false;state.selected[replacement]=p.id;replacement=null;mode='selected';$('search').value='';}else{if(state.selected.length>=LIMIT){status('已选满 15 张，请先点入选照片的“换一张”。',true);return;}state.selected.push(p.id);}p.reviewed=false;changed();}));
    body.append(actions);
    const feedback=document.createElement('select');feedback.className='feedback';feedback.setAttribute('aria-label','选片反馈');for(const s of ['','游客太多','场景认错','不喜欢','重复场景','主体裁切','待核实名称'])feedback.add(new Option(s||'记录选片反馈',s));feedback.value=p.feedback||'';feedback.onchange=()=>{p.feedback=feedback.value;p.rejected=['游客太多','场景认错','不喜欢','重复场景'].includes(p.feedback);p.reviewed=false;check.checked=false;persist();summary();};body.append(feedback);
    const label=document.createElement('label');label.className='approve';label.append(check,document.createTextNode('画面、地点与说明已核对'));check.onchange=()=>{if(check.checked&&(!p.title?.trim()||!p.note?.trim()||p.identity==='待核实')){check.checked=false;status('先填写名称和注释，并处理待核实场景，再确认审核。',true);return;}p.reviewed=check.checked;card.classList.toggle('checked',p.reviewed);persist();summary();};body.append(label);card.append(body);$('grid').append(card);
  }
}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function compress(input){
  const url=typeof input==='string'?input:URL.createObjectURL(input),image=new Image();
  try{image.src=url;await image.decode();const width=image.naturalWidth,height=image.naturalHeight;const scale=Math.min(1,1280/Math.max(width,height));const c=document.createElement('canvas');c.width=Math.round(width*scale);c.height=Math.round(height*scale);const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.drawImage(image,0,0,c.width,c.height);
    let data;for(const quality of [.82,.7,.55,.4,.25,.15]){data=c.toDataURL('image/jpeg',quality);if(atob(data.split(',')[1]).length<=200*1024)break;}if(atob(data.split(',')[1]).length>200*1024)throw new Error('压缩后过大');
    const tiny=document.createElement('canvas');tiny.width=96;tiny.height=72;const t=tiny.getContext('2d',{willReadFrequently:true});t.drawImage(image,0,0,96,72);const pixels=t.getImageData(0,0,96,72).data,gray=[];let clipped=0,edges=0;
    for(let i=0;i<pixels.length;i+=4){const v=(pixels[i]+pixels[i+1]+pixels[i+2])/3;gray.push(v);if(v<10||v>245)clipped++;}for(let y=1;y<71;y++)for(let x=1;x<95;x++){const i=y*96+x;edges+=Math.abs(4*gray[i]-gray[i-1]-gray[i+1]-gray[i-96]-gray[i+96]);}
    let hash='';for(let y=0;y<8;y++)for(let x=0;x<8;x++)hash+=gray[y*9*96+x*10]>gray[y*9*96+(x+1)*10]?'1':'0';
    const score=Math.round(40*Math.min(1,edges/(70*94)/40)+30*(1-clipped/gray.length)+20*Math.min(width/height,1.5)/1.5+10*Math.min(1,width*height/2000000));
    return {data,width:c.width,height:c.height,originalWidth:width,originalHeight:height,score,hash};
  }finally{if(typeof input!=='string')URL.revokeObjectURL(url);}
}
function safeProject(p){
  if(p?.format!=='atlas-photo-project-v1'||!Array.isArray(p.items)||p.items.length>2000||!Array.isArray(p.selected)||p.selected.length>LIMIT)throw new Error('不是有效的照片审核项目。');
  const ids=new Set();for(const x of p.items){if(typeof x.id!=='string'||ids.has(x.id)||typeof x.data!=='string'||!x.data.startsWith('data:image/jpeg;base64,')||x.data.length>273100)throw new Error('项目含有重复照片或无效图片。');ids.add(x.id);for(const k of ['title','note','filename','reason','feedback','credit','sourceUrl','memory','scene','identity','evidence','researchUrl'])if(x[k]!=null&&typeof x[k]!=='string')throw new Error('项目文本格式不正确。');x.identity ||= x.reviewed?'已确认':'待核实';x.scene ||= '待分类';delete x.thumbnail;}
  if(new Set(p.selected).size!==p.selected.length||p.selected.some(id=>!ids.has(id)))throw new Error('入选照片清单不正确。');return p;
}
function adopt(p){state=p;$('place').value=p.place||'';$('place-id').value=p.placeId||'';replacement=null;mode='selected';$('search').value='';changed();}
function replaceOK(){return !state.items.length||confirm('打开新项目会替换当前审核台。需要留存时，请先点击“备份审核项目”。继续吗？');}
function task(fn){return async(...args)=>{if(busy)return;busy=true;$('grid').inert=true;document.querySelectorAll('.tools button,.tools input,.tabs button').forEach(x=>x.disabled=true);try{await fn(...args);}catch(e){status(e.message,true);}finally{busy=false;$('grid').inert=false;document.querySelectorAll('.tools button,.tools input,.tabs button').forEach(x=>x.disabled=false);summary();}};}
function importFolder(primary){return task(async e=>{
  const files=[...e.target.files].filter(f=>/\.(jpe?g|png|webp)$/i.test(f.name));e.target.value='';
  if(!files.length)throw Error('没有找到 JPEG、PNG 或 WebP 照片。视频已跳过。');
  if(primary&&files.length>LIMIT)throw Error('精选文件夹最多 15 张。完整相册请用“添加完整相册／补选照片”。');
  if(!primary&&state.items.length+files.length>2000)throw Error('单个审核项目最多处理 2000 张照片。');
  if(primary&&!replaceOK())return;
  const items=[],failed=[];let duplicates=0;
  for(const [i,f]of files.entries()){
    status(`正在本机处理 ${i+1}/${files.length}：${f.name}`);
    try{const image=await compress(f);if([...items,...(primary?[]:state.items)].some(x=>x.data===image.data)){duplicates++;continue;}
      items.push({id:crypto.randomUUID(),filename:f.webkitRelativePath||f.name,...image,title:'',note:'',reviewed:false,locked:primary,scene:'待分类',identity:'待核实',memory:'',evidence:'',researchUrl:'',reason:primary?'你的精选，补选时保留。':'补选来源：请核对场景与游客。'});
    }catch{failed.push(f.name);}
  }
  if(!items.length){status(`未添加新照片；${duplicates} 张重复，${failed.length} 张无法读取。`,!!failed.length);return;}
  if(primary)adopt({format:'atlas-photo-project-v1',place:$('place').value||files[0].webkitRelativePath.split('/')[0],placeId:$('place-id').value,items,selected:items.map(x=>x.id)});
  else{state.items.push(...items);changed();}
  status(`已${primary?'保留精选':'添加备选'} ${items.length} 张，跳过 ${duplicates} 张重复照片。${failed.length?' 无法读取：'+failed.join('、'):''}${primary?' 请补充你的记忆，再添加完整相册。':' 点击补选按钮，或在备选库自行加入。'}`);
});}
$('folder').onchange=importFolder(true);$('additional-folder').onchange=importFolder(false);
$('project-file').onchange=task(async e=>{const f=e.target.files[0];e.target.value='';if(!f||!replaceOK())return;if(f.size>100*1024*1024)throw new Error('项目超过 100 MB。');adopt(safeProject(JSON.parse(await f.text())));status('审核项目已恢复。');});
$('save-project').onclick=()=>download(state,`${state.placeId||'photos'}-review-project.json`);
$('auto').onclick=()=>{if(busy)return;if(state.selected.some(id=>!state.items.find(x=>x.id===id)?.locked)&&!confirm('会重选未锁定照片；你的精选与所有已写备注会保留。继续吗？'))return;state.selected=supplement(state);replacement=null;mode='selected';changed();status(`已保留精选并补选至 ${state.selected.length} 张。技术筛选不能辨认游客与房间，新增照片仍需审核。`);};
$('order').onclick=()=>{state.selected=orderPhotos(state);replacement=null;mode='selected';changed();status('已按外观、景观、核心空间、展品、人物故事、后勤排序；待分类照片排在最后，你仍可调整。');};
$('research-export').onclick=()=>{if(!state.items.length){status('请先导入照片。',true);return;}download({format:'atlas-photo-research-request-v1',place:state.place,placeId:state.placeId,selected:state.selected,photos:state.items.map(p=>({id:p.id,filename:p.filename,data:p.data,selected:state.selected.includes(p.id),locked:!!p.locked,memory:p.memory||'',title:p.title||'',note:p.note||'',scene:p.scene||'待分类',identity:p.identity||'待核实',feedback:p.feedback||''}))},`${state.placeId||'photos'}-research-request.json`);status('资料已导出，包含照片和个人记忆。交给 Codex 后可结合网络查证，返回查证结果供你导入审核；此操作没有自动发送资料。');};
const researchLabel=document.createElement('label');researchLabel.className='button';researchLabel.textContent='导入查证与文案结果';const researchFile=document.createElement('input');researchFile.type='file';researchFile.accept='application/json';researchFile.hidden=true;researchLabel.append(researchFile);document.querySelector('.buttons').append(researchLabel);
researchFile.onchange=task(async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>5*1024*1024)throw Error('查证结果过大。');applyResearch(state,JSON.parse(await f.text()));changed();status('已导入查证与文案建议，更新的照片需要重新审核；精选和你的记忆已保留。');});
$('selected-tab').onclick=()=>{replacement=null;mode='selected';render();};$('library-tab').onclick=()=>{replacement=null;mode='library';render();};$('search').oninput=render;$('cover').onchange=()=>$('grid').classList.toggle('cover',$('cover').checked);$('place').oninput=sync;$('place-id').oninput=()=>{state.items.forEach(p=>p.reviewed=false);sync();render();};$('close-image').onclick=()=>$('lightbox').close();
$('export').onclick=task(async()=>{const problems=reviewIssues(state);if(problems.length)throw new Error(problems.join('；'));const photos=[];for(const id of state.selected){const p=state.items.find(x=>x.id===id);photos.push({...await compress(p.data),caption:p.title.trim()+'：'+p.note.trim(),alt:p.title.trim(),filename:p.filename,reviewed:true,credit:p.credit||'',...(p.sourceUrl?{sourceUrl:p.sourceUrl}:{})});}const bundle=assertPackage({format:'atlas-photo-review-v1',approved:true,placeId:state.placeId,place:state.place,reviewedAt:new Date().toISOString(),photos});download(bundle,`${state.placeId}-approved-photos.json`);status('发布包已下载。进入作者编辑室，选择同一地点并导入发布包，再点击“发布到地图”。');});
if(['localhost','127.0.0.1'].includes(location.hostname)){$('demo').hidden=false;$('demo').onclick=task(async()=>{if(!replaceOK())return;status('正在读取本地 Britannia 示例…');const r=await fetch('/local-review/manifest.json');if(!r.ok)throw new Error('请使用照片审核台的本地启动脚本加载示例。');const p=await r.json();for(const [i,item]of p.items.entries()){status(`正在准备示例 ${i+1}/${p.items.length}`);Object.assign(item,await compress(item.data));}adopt(safeProject(p));status(`已载入 ${p.items.length} 张原片的网页副本，15 张场景推荐待你审核。`);});}
try{const db=await dbPromise;const p=await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(p)adopt(safeProject(p));else render();}catch{render();status('本机存储不可用，请使用“备份审核项目”保存进度。',true);}
if(['localhost','127.0.0.1'].includes(location.hostname)){for(const a of document.querySelectorAll('a[href="/author/"]'))a.href='https://iris.icewindwillow.cn/author/';}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearTimeout(saveTimer);writeState();}});
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
