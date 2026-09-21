import {validRating} from './geo.v0.4.js';
const $=id=>document.getElementById(id);
let session=null,record=null,dirty=false,busy=false,expiryTimer=null;
function message(value,error=false){$('desk-message').textContent=value;$('desk-message').classList.toggle('error',error);}
function displayStars(el,value){
  el.replaceChildren();el.setAttribute('role','img');el.setAttribute('aria-label',value===null?'尚未评分':`${value} 星，满分 5 星`);
  if(!validRating(value)){const label=document.createElement('span');label.className='unrated';label.textContent='尚未评分';el.append(label);return;}
  for(let i=0;i<5;i++){const star=document.createElement('span');star.className='star';star.textContent='☆';const fill=document.createElement('span');fill.className='star-fill';fill.style.width=`${Math.max(0,Math.min(1,value-i))*100}%`;fill.textContent='★';star.append(fill);el.append(star);}
}
function formReview(){return {author:$('review-author').value,rating:$('review-unrated').checked?null:Number($('review-rating').value),comment:$('review-comment').value};}
function preview(){
  const r=formReview();displayStars($('rating-preview'),r.rating);
  $('rating-output').textContent=r.rating===null?'尚未评分':`${r.rating.toFixed(1)} / 5`;
  $('review-rating').setAttribute('aria-valuetext',r.rating===null?'尚未评分':`${r.rating} 星`);
  $('review-rating').disabled=$('review-unrated').checked;
  $('half-minus').disabled=r.rating===null||r.rating===0;$('half-plus').disabled=r.rating===null||r.rating===5;
  $('character-count').textContent=`${r.comment.length} / 10000`;
  $('live-comment').textContent=r.comment||'写下你的感受…';$('live-author').textContent=r.author?`— ${r.author}`:'';
}
function setBusy(value){busy=value;$('editor-fields').disabled=value||!session;$('reload-cloud').disabled=value;$('discard-draft').disabled=value||!session||!record?.hasDraft;$('download-review').disabled=false;}
function timeLabel(value){const normalized=typeof value==='string'&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)?value.replace(' ','T')+'Z':value;const d=new Date(normalized);return Number.isFinite(d.getTime())?d.toLocaleString('zh-CN'):'时间待确认';}
function showRecord(data){
  record=data;const r=data.draft||data.review;
  $('review-author').value=r.author;$('review-comment').value=r.comment;
  $('review-unrated').checked=r.rating===null;$('review-rating').value=String(r.rating===null?0:r.rating);
  displayStars($('published-stars'),data.review.rating);$('published-comment').textContent=data.review.comment||'尚未写下评价。';$('published-author').textContent=data.review.author?`— ${data.review.author}`:'';
  $('published-version').textContent='已发布';$('published-time').textContent=`发布时间：${timeLabel(data.publishedAt)}（不是旅行日期）`;
  $('draft-badge').textContent=data.hasDraft?'已载入云端草稿':'与公开版本一致';$('discard-draft').disabled=!data.hasDraft;
  $('save-detail').textContent=`记录版本 ${data.revision} · 最近保存：${timeLabel(data.updatedAt)}`;
  dirty=false;preview();
}
async function readResponse(response){
  if(response.redirected||!response.headers.get('Content-Type')?.includes('application/json'))throw Object.assign(new Error('登录可能已过期，或作者接口没有部署。请先备份文字，再重新登录。'),{code:'LOGIN_REQUIRED'});
  const data=await response.json();if(!response.ok||!data.ok)throw Object.assign(new Error(data.message||`请求失败（${response.status}）`),{code:data.code,status:response.status});return data;
}
function fail(error){
  const msg=error.name==='TimeoutError'||error.name==='AbortError'?'请求超时，保存结果尚未确认。请保持当前文字，备份后读取云端核对；不要直接关闭页面。':error.message;
  message(msg,true);
  if(['LOGIN_REQUIRED','CSRF_REJECTED','NOT_AN_AUTHOR','ACCESS_CONFIG_REQUIRED','AUTHOR_CONFIG_REQUIRED'].includes(error.code)){
    session=null;$('login-help').hidden=false;$('identity-label').textContent='需要验证作者身份';
  }
}
async function load(force=false){
  if(busy)return;
  if(dirty&&!force&&!confirm('当前还有未保存的修改。读取云端会替换这些输入。确定继续？'))return;
  setBusy(true);message('正在验证作者身份并读取云端记录…');
  try{
    const response=await fetch('/author/api/session',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(12000)});
    const data=await readResponse(response);session={csrf:data.csrf,author:data.author};showRecord(data.record);
    $('identity-label').textContent=`已登录 · ${data.author.email}`;$('login-help').hidden=true;
    message(data.record.hasDraft?'已读取云端草稿。它还没有发布，公开地图保持原来的评价。':'已连接云端。现在可以保存草稿，或把新评价发布到地图。');
    clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>{session=null;setBusy(false);message('登录已到期。当前输入已保留；请先备份文字，再重新登录。',true);$('login-help').hidden=false;},Math.max(0,Math.min(2147483647,data.author.expiresAt*1000-Date.now())));
  }catch(error){fail(error);}finally{setBusy(false);}
}
async function save(action){
  if(!session||busy||!record)return;
  if(action==='publish'&&!confirm('发布后，所有访客都能看到这条评价。确认发布到地图？'))return;
  if(action==='discard-draft'&&!confirm('只丢弃云端草稿，已发布评价保持不变。确认继续？'))return;
  const review=formReview();if(review.rating!==null&&!validRating(review.rating)){message('评分只能为 0～5 星，每次半星。',true);return;}
  setBusy(true);message(action==='publish'?'正在发布，请等待服务器确认…':action==='draft'?'正在保存到云端…':'正在丢弃草稿…');
  try{
    const response=await fetch('/author/api/review',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Atlas-CSRF':session.csrf},body:JSON.stringify({id:'fountains-abbey',revision:record.revision,action,review}),signal:AbortSignal.timeout(15000)});
    const data=await readResponse(response);showRecord(data.record);
    message(action==='publish'?'服务器已确认发布。两个公开域名读取同一条云端评价，重新打开地图即可查看。':action==='draft'?'服务器已确认保存云端草稿。换一台设备登录后可以继续编辑；访客仍看到已发布版本。':'云端草稿已丢弃，公开评价没有改变。');
  }catch(error){fail(error);}finally{setBusy(false);}
}
function backup(){
  const blob=new Blob([JSON.stringify({recordId:'fountains-abbey',review:formReview(),basedOnRevision:record?.revision||null,note:'手动备份，不代表已发布'},null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fountains-abbey-review-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
$('cloud-form').addEventListener('submit',e=>e.preventDefault());
for(const id of ['review-author','review-comment','review-rating','review-unrated'])$(id).addEventListener('input',()=>{dirty=true;$('draft-badge').textContent='有未保存的修改';preview();});
for(const [id,delta]of [['half-minus',-.5],['half-plus',.5]])$(id).addEventListener('click',()=>{$('review-rating').value=String(Math.max(0,Math.min(5,Number($('review-rating').value)+delta)));dirty=true;$('draft-badge').textContent='有未保存的修改';preview();});
$('save-cloud-draft').addEventListener('click',()=>save('draft'));$('publish-review').addEventListener('click',()=>save('publish'));$('discard-draft').addEventListener('click',()=>save('discard-draft'));$('reload-cloud').addEventListener('click',()=>load());$('download-review').addEventListener('click',backup);
window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
for(const link of [$('logout'),$('relogin')])link.addEventListener('click',e=>{if((dirty||busy)&&!confirm('当前内容尚未确认保存。请先备份文字；仍要离开？'))e.preventDefault();});
for(const button of document.querySelectorAll('[data-photo]'))button.addEventListener('click',()=>{const name=button.dataset.photo;$('desk-photo').src=`/assets/photos/fountains-abbey/${name}.v0.3.jpg`;$('desk-photo').alt=name==='nave'?'流水修道院内部，石柱在草地上投下影子。':'流水修道院外景，石砌尖拱与塔楼。';for(const b of document.querySelectorAll('[data-photo]')){b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));}});
preview();load(true);
