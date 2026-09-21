import {UK_BOUNDS,REGIONS,project,unproject,validateMemories,filterMemories,clusterPoints,featurePath} from './geo.js';

const $=id=>document.getElementById(id);
const svgNS='http://www.w3.org/2000/svg';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const small=()=>matchMedia('(max-width: 760px)').matches;
const state={real:[],demos:[],items:[],filtered:[],region:'all',query:'',selected:null,online:false,loadingStreet:false};
const icon=name=>{const s=document.createElementNS(svgNS,'svg');s.setAttribute('class','icon');s.setAttribute('aria-hidden','true');const u=document.createElementNS(svgNS,'use');u.setAttribute('href',`#i-${name}`);s.append(u);return s;};
const text=(tag,className,value)=>{const el=document.createElement(tag);if(className)el.className=className;if(value!=null)el.textContent=value;return el;};
let toastTimer;
function notify(message,ms=4300){clearTimeout(toastTimer);$('map-status').textContent=message;if(ms)toastTimer=setTimeout(()=>$('map-status').textContent='',ms);}
async function readJson(path,key){
  const embedded=$('atlas-embedded');if(embedded){const all=JSON.parse(embedded.textContent);return all[key];}
  const r=await fetch(path,{cache:'no-cache',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error(`未能读取 ${path}（${r.status}）`);return r.json();
}

class OverviewMap{
  constructor(){
    this.surface=$('map-surface');this.svg=$('atlas-svg');this.group=$('geographic-layer');this.camera={s:1,x:0,y:0};this.base=1;this.width=0;this.height=0;this.points=new Map();this.animation=0;
    this.surface.tabIndex=0;this.surface.setAttribute('role','region');this.surface.setAttribute('aria-label','互动地图。方向键移动，加减号缩放，Home 回到全览。');
    new ResizeObserver(()=>this.resize()).observe(this.surface);
    this.bind();
  }
  setGeography(data){
    if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('总览地理数据格式不正确。');
    const frag=document.createDocumentFragment();
    for(const f of data.features){const p=document.createElementNS(svgNS,'path');p.setAttribute('d',featurePath(f));p.setAttribute('class',`coast-${f.properties.kind}`);frag.append(p);}
    this.group.replaceChildren(frag);this.reset(false);
  }
  resize(){
    const w=this.surface.clientWidth,h=this.surface.clientHeight;if(!w||!h||w===this.width&&h===this.height)return;
    const previous=this.width?this.toGeo([this.width/2,this.height/2]):null;
    const relative=this.camera.s/this.base;this.width=w;this.height=h;
    const full=this.cameraFor(UK_BOUNDS,false);this.base=full.s;
    if(previous&&relative>1.12){const p=project(previous);this.camera={s:full.s*relative,x:w/2-p[0]*full.s*relative,y:h/2-p[1]*full.s*relative};}
    else this.camera=full;
    this.render();if(streetMap)streetMap.resize();
  }
  cameraFor(bounds,panel=false){
    const [west,south,east,north]=bounds;const a=project([west,north]),b=project([east,south]);
    const left=small()?29:68,right=panel&&!small()?365:(small()?29:78),top=small()?90:88,bottom=small()?62:67;
    const s=Math.min((this.width-left-right)/Math.max(.01,b[0]-a[0]),(this.height-top-bottom)/Math.max(.01,b[1]-a[1]));
    return {s,x:left+(this.width-left-right)/2-(a[0]+b[0])*s/2,y:top+(this.height-top-bottom)/2-(a[1]+b[1])*s/2};
  }
  screen(coords){const p=project(coords),c=this.camera;return [p[0]*c.s+c.x,p[1]*c.s+c.y];}
  toGeo([x,y]){const c=this.camera;return unproject([(x-c.x)/c.s,(y-c.y)/c.s]);}
  render(){const c=this.camera;this.group.setAttribute('transform',`translate(${c.x},${c.y}) scale(${c.s})`);if(!state.online)renderOverlays();}
  animate(target,animated=true){
    cancelAnimationFrame(this.animation);const from={...this.camera};
    if(!animated||reduced){this.camera=target;this.render();return;}
    const started=performance.now();
    const step=now=>{const t=Math.min(1,(now-started)/650),k=1-(1-t)**3;this.camera={s:from.s+(target.s-from.s)*k,x:from.x+(target.x-from.x)*k,y:from.y+(target.y-from.y)*k};this.render();if(t<1)this.animation=requestAnimationFrame(step);};
    this.animation=requestAnimationFrame(step);
  }
  reset(animated=true){const c=this.cameraFor(UK_BOUNDS);this.base=c.s;this.animate(c,animated);}
  focus(coords,multiplier=2.5){
    const p=project(coords);const s=Math.max(this.base,Math.min(this.base*18,this.base*multiplier));
    const reserve=$('story-panel').open&&!small()?350:0;
    this.animate({s,x:(this.width-reserve)/2-p[0]*s,y:this.height*.48-p[1]*s});
  }
  fit(items){
    const coords=items.filter(m=>m.coordinates).map(m=>m.coordinates);if(!coords.length)return;
    if(coords.length===1){this.focus(coords[0],3);return;}
    const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);const bounds=[Math.min(...xs)-.6,Math.min(...ys)-.5,Math.max(...xs)+.6,Math.max(...ys)+.5];
    const c=this.cameraFor(bounds);const s=Math.max(this.base,Math.min(c.s,this.base*12));const a=project([bounds[0],bounds[3]]),b=project([bounds[2],bounds[1]]);c.x+=(a[0]+b[0])/2*(c.s-s);c.y+=(a[1]+b[1])/2*(c.s-s);c.s=s;
    this.animate(c);
  }
  zoom(factor,point=[this.width/2,this.height/2]){
    cancelAnimationFrame(this.animation);const c=this.camera;
    const s=Math.max(this.base*.82,Math.min(this.base*18,c.s*factor));
    if(s===c.s&&factor>1)notify('总览已经放大到上限。具体道路请切换「街道底图」。');
    const r=s/c.s;this.camera={s,x:point[0]-(point[0]-c.x)*r,y:point[1]-(point[1]-c.y)*r};this.render();
  }
  pan(dx,dy){cancelAnimationFrame(this.animation);this.camera.x+=dx;this.camera.y+=dy;this.constrain();this.render();}
  constrain(){const c=this.camera,p=this.toGeo([this.width/2,this.height/2]);const q=project([Math.max(-13,Math.min(7,p[0])),Math.max(48,Math.min(63,p[1]))]);c.x=this.width/2-q[0]*c.s;c.y=this.height/2-q[1]*c.s;}
  bind(){
    const pos=e=>{const r=this.surface.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
    this.surface.addEventListener('pointerdown',e=>{
      if(state.online||e.target.closest('button')||e.button!==0)return;
      cancelAnimationFrame(this.animation);this.points.set(e.pointerId,pos(e));this.surface.setPointerCapture(e.pointerId);this.surface.classList.add('is-dragging');
    });
    this.surface.addEventListener('pointermove',e=>{
      if(state.online||!this.points.has(e.pointerId))return;
      const before=[...this.points.values()],old=this.points.get(e.pointerId),now=pos(e);this.points.set(e.pointerId,now);
      if(this.points.size===2){const after=[...this.points.values()];const d0=Math.hypot(before[0][0]-before[1][0],before[0][1]-before[1][1]);const d1=Math.hypot(after[0][0]-after[1][0],after[0][1]-after[1][1]);if(d0>0)this.zoom(d1/d0,[(before[0][0]+before[1][0])/2,(before[0][1]+before[1][1])/2]);this.pan((now[0]-old[0])/2,(now[1]-old[1])/2);}
      else if(this.points.size===1)this.pan(now[0]-old[0],now[1]-old[1]);
    });
    const end=e=>{this.points.delete(e.pointerId);if(!this.points.size)this.surface.classList.remove('is-dragging');};
    this.surface.addEventListener('pointerup',end);this.surface.addEventListener('pointercancel',end);this.surface.addEventListener('lostpointercapture',end);
    this.surface.addEventListener('wheel',e=>{if(state.online)return;e.preventDefault();this.zoom(Math.exp(-Math.max(-150,Math.min(150,e.deltaY))*.002),pos(e));},{passive:false});
    this.surface.addEventListener('dblclick',e=>{if(state.online||e.target.closest('button'))return;this.zoom(1.7,pos(e));});
    this.surface.addEventListener('keydown',e=>{
      if(e.target.closest('button')||state.online)return;const moves={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]};
      if(moves[e.key]){e.preventDefault();this.pan(...moves[e.key]);}
      if(e.key==='+'||e.key==='='){e.preventDefault();this.zoom(1.3);}
      if(e.key==='-'){e.preventDefault();this.zoom(1/1.3);}
      if(e.key==='Home'){e.preventDefault();resetView();}
    });
  }
}

const labelData=[
  {point:[-4.35,56.55],zh:'苏格兰',en:'SCOTLAND',kind:'region'},
  {point:[-1.75,52.8],zh:'英格兰',en:'ENGLAND',kind:'region'},
  {point:[-4.3,52.35],zh:'威尔士',en:'WALES',kind:'region'},
  {point:[-7.1,54.93],zh:'北爱尔兰',en:'NORTHERN IRELAND',kind:'region'},
  {point:[-8.15,53.2],zh:'爱尔兰',en:'IRELAND',kind:'neighbour'},
  {point:[-1.15,60.73],zh:'设得兰群岛',en:'Shetland',kind:'island'},
  {point:[-2.65,59.28],zh:'奥克尼群岛',en:'Orkney',kind:'island'},
  {point:[-7.2,58.07],zh:'外赫布里底群岛',en:'Outer Hebrides',kind:'island'},
  {point:[-4.7,54.14],zh:'马恩岛',en:'Isle of Man',kind:'island'},
  {point:[-10.15,55.9],zh:'NORTH',en:'ATLANTIC OCEAN',kind:'sea'},
  {point:[1.9,56.35],zh:'NORTH SEA',en:'',kind:'sea'},
  {point:[.5,48.65],zh:'法国',en:'FRANCE',kind:'neighbour'},
  {point:[7,59.6],zh:'挪威',en:'NORWAY',kind:'neighbour'},
  {point:[5.4,52.0],zh:'荷兰',en:'NETHERLANDS',kind:'neighbour'}
];
const labelEls=labelData.map(d=>{const el=text('div',`geo-label ${d.kind}`);el.append(text(d.kind==='region'?'strong':'span','',d.zh));if(d.en){if(d.kind!=='region')el.append(document.createElement('br'));el.append(text('small','',d.en));}$('labels-layer').append(el);return el;});
const markerEls=new Map();
let atlas;
function screenPoint(coords){if(state.online&&streetMap){const p=streetMap.project(coords);return [p.x,p.y];}return atlas.screen(coords);}
function renderOverlays(){
  if(!atlas?.width)return;
  const w=atlas.width,h=atlas.height,zoomRatio=atlas.camera.s/atlas.base;
  labelData.forEach((d,i)=>{const el=labelEls[i],p=atlas.screen(d.point);el.style.left=`${p[0]}px`;el.style.top=`${p[1]}px`;el.hidden=state.online||p[0]<-70||p[0]>w+70||p[1]<10||p[1]>h-25||zoomRatio>3.5;el.style.opacity=zoomRatio>2?'0.45':'';});
  const groups=clusterPoints(state.filtered,screenPoint,small()?29:31);
  const allPins=groups.map(g=>({x:g.x-14,y:g.y-14,w:28,h:28}));
  const placed=[];const keep=new Set();
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  for(const g of groups){
    if(g.x<-60||g.x>w+60||g.y<-60||g.y>h+60)continue;
    const ids=g.items.map(m=>m.id);const key=ids.join('|');keep.add(key);
    let el=markerEls.get(key);
    if(!el){
      el=text('button','map-marker');el.type='button';el.dataset.markerId=key;
      const hit=text('span','pin-hit');hit.append(text('span','pin-dot'));el.append(hit,text('span','pin-label'));
      el.addEventListener('click',()=>{const items=el._items;if(items.length===1)openStory(items[0],el);else expandCluster(items);});
      $('marker-layer').append(el);markerEls.set(key,el);
    }
    el._items=g.items;el.style.left=`${g.x}px`;el.style.top=`${g.y}px`;el.classList.toggle('cluster',ids.length>1);el.classList.toggle('is-selected',ids.includes(state.selected?.id));
    el.setAttribute('aria-label',ids.length>1?`展开 ${ids.length} 个地点：${g.items.map(m=>m.place).join('、')}`:`${g.items[0].place||g.items[0].title}，${g.items[0].demo?'演示地点':'阅读故事'}`);
    const dot=el.querySelector('.pin-dot');dot.textContent=ids.length>1?String(ids.length):'';
    const label=el.querySelector('.pin-label');label.replaceChildren(text('span','',ids.length>1?`${ids.length} 个地点`:(g.items[0].place||g.items[0].title)));
    if(ids.length===1&&g.items[0].placeEn)label.append(text('small','',g.items[0].placeEn));
    const labelW=label.offsetWidth||100,labelH=label.offsetHeight||28;
    let candidates=[[16,-labelH/2],[-labelW-16,-labelH/2],[-labelW/2,-labelH-17],[-labelW/2,18]];
    if(ids.includes('demo-oxford'))candidates=[candidates[2],...candidates];
    if(ids.includes('demo-cardiff'))candidates=[candidates[1],...candidates];
    let offset=null;
    for(const [x,y] of candidates){const box={x:g.x+x-3,y:g.y+y-3,w:labelW+6,h:labelH+6};if(box.x<8||box.x+box.w>w-8||box.y<83||box.y+box.h>h-35)continue;if(placed.some(b=>overlap(box,b))||allPins.some(b=>overlap(box,b)))continue;offset=[x,y];placed.push(box);break;}
    label.style.visibility=offset?'visible':'hidden';if(offset){label.style.left=`${offset[0]}px`;label.style.top=`${offset[1]}px`;}
  }
  for(const [key,el] of markerEls)if(!keep.has(key)){el.remove();markerEls.delete(key);}
  $('map-dedication').style.opacity=state.online||zoomRatio>1.5||$('story-panel').open?'0':'1';
  if(!state.online){
    const lat=atlas.toGeo([w/2,h/2])[1];const kmPerPx=111.32*Math.cos(lat*Math.PI/180)/atlas.camera.s;
    const km=[1,2,5,10,20,50,100,200,500,1000].filter(k=>k/kmPerPx<=85).at(-1)||1;
    $('scale-text').textContent=`${km} km`;$('scale-line').style.width=`${km/kmPerPx}px`;
  }
}
function expandCluster(items){
  if(items.every(m=>m.coordinates&&Math.hypot(m.coordinates[0]-items[0].coordinates[0],m.coordinates[1]-items[0].coordinates[1])<.0001)){openStory(items[0]);notify('同一位置有多篇故事，可用卡片底部的上一页 / 下一页阅读。');return;}
  if(state.online){const b=new window.maplibregl.LngLatBounds();items.forEach(m=>b.extend(m.coordinates));streetMap.fitBounds(b,{padding:95,maxZoom:15,duration:reduced?0:650});}
  else atlas.fit(items);
}
function resetView(){closeStory(false);$('map-context').replaceChildren(document.createTextNode('英国全览 ／ 每个坐标，都等着一个故事'));if(state.online)streetMap.fitBounds([[UK_BOUNDS[0],UK_BOUNDS[1]],[UK_BOUNDS[2],UK_BOUNDS[3]]],{padding:{top:90,bottom:65,left:40,right:50},duration:reduced?0:700});else atlas.reset();}
function refreshCollection(){
  const existing=new Set(state.real.map(m=>m.id));state.items=[...state.real,...($('show-demos').checked?state.demos.filter(m=>!existing.has(m.id)):[])];
  state.filtered=filterMemories(state.items,state.region,state.query);
  const demoOnly=state.items.length>0&&state.items.every(m=>m.demo);
  const count=new Set(state.items.map(m=>m.place?.trim()).filter(Boolean)).size;
  $('place-count').textContent=String(count).padStart(2,'0');$('place-count').nextElementSibling.textContent=demoOnly?'示范地点':'收录地点';$('memory-count').textContent=String(state.real.length).padStart(2,'0');
  $('map-key-label').textContent=demoOnly?'演示地点':state.items.some(m=>m.demo)?'真实与演示地点':'故事地点';
  $('result-count').textContent=`${String(state.filtered.length).padStart(2,'0')} 个条目`;
  const f=document.createDocumentFragment();
  state.filtered.forEach((m,i)=>{
    const row=text('button','memory-row');row.type='button';row.dataset.id=m.id;row.setAttribute('aria-pressed',String(state.selected?.id===m.id));
    row.append(text('span','row-number',String(i+1).padStart(2,'0')));
    const body=text('span','row-body');const title=text('span','row-title');title.append(text('strong','',m.place||'地点待补'));if(m.placeEn)title.append(text('small','',m.placeEn));body.append(title,text('span','row-sub',[REGIONS[m.region],m.category,m.demo?'演示':(m.date||'日期待补'),!m.coordinates?'定位待补':''].filter(Boolean).join(' · ')));row.append(body);const arrow=icon('arrow');arrow.classList.add('row-arrow');row.append(arrow);row.addEventListener('click',()=>openStory(m,row));f.append(row);
  });
  if(!state.filtered.length){const e=text('div','empty-state');e.append(text('strong','',state.query?'还没找到这个地点。':'留白，是故事的开始。'),document.createTextNode(state.query?'试试别的名字。这里只搜索已经收录的内容。':state.items.length?'这个地区暂时没有记录。':'打开演示地点，可以先体验这张地图。'));f.append(e);}
  $('memory-list').replaceChildren(f);
  if(state.selected&&!state.filtered.some(m=>m.id===state.selected.id))closeStory(false);
  renderOverlays();
}
let lastFocus=null;
function openStory(m,trigger=null){
  state.selected=m;
  const panel=$('story-panel');
  if(trigger)lastFocus=trigger;else if(!panel.open)lastFocus=document.activeElement;
  $('story-kind').textContent=m.demo?'DEMO POSTCARD / 演示卡片':'A KEPT MOMENT / 故事卡片';
  $('story-region').textContent=[REGIONS[m.region],m.category,m.demo?'日期待填写':m.date].filter(Boolean).join(' · ');
  $('story-place').replaceChildren(document.createTextNode(m.place||'地点待补'));if(m.placeEn)$('story-place').append(text('small','',m.placeEn));
  $('story-title').textContent=m.title;$('story-description').textContent=m.description||'这段故事还没有写下。';
  $('story-location').textContent=m.coordinates?`${m.locationPrecision||'记录坐标'}\n${Math.abs(m.coordinates[1]).toFixed(4)}° ${m.coordinates[1]>=0?'N':'S'} · ${Math.abs(m.coordinates[0]).toFixed(4)}° ${m.coordinates[0]>=0?'E':'W'}`:'这个故事还没有坐标；先保留文字，不猜测它的位置。';
  $('story-location').style.whiteSpace='pre-line';$('story-disclaimer').hidden=!m.demo;$('story-street').hidden=!m.coordinates;
  const art=$('story-art');art.querySelectorAll('img').forEach(i=>i.remove());$('story-art-en').textContent=m.placeEn||'A little memory';
  if(m.photo){const im=document.createElement('img');im.src=m.photo;im.alt=m.photoAlt||`${m.place||'故事'}的照片`;im.loading='lazy';im.addEventListener('error',()=>im.remove(),{once:true});art.append(im);}
  const i=state.filtered.findIndex(x=>x.id===m.id);$('story-index').textContent=`${String(i+1).padStart(2,'0')} / ${String(state.filtered.length).padStart(2,'0')}`;$('previous-story').disabled=i<=0;$('next-story').disabled=i>=state.filtered.length-1;
  if(!panel.open)panel.show();panel.scrollTop=0;
  document.querySelectorAll('.memory-row').forEach(row=>row.setAttribute('aria-pressed',String(row.dataset.id===m.id)));
  $('map-context').textContent=[m.place,m.placeEn,m.demo?'演示地点':'故事地点'].filter(Boolean).join(' ／ ');
  try{history.replaceState(null,'',`#place=${encodeURIComponent(m.id)}`);}catch{/* sandboxed/file previews may restrict history */}
  if(m.coordinates){if(state.online)streetMap.flyTo({center:m.coordinates,zoom:11,padding:{top:30,bottom:20,left:0,right:small()?0:350},duration:reduced?0:850});else atlas.focus(m.coordinates,2.8);}
  $('story-place').focus({preventScroll:true});renderOverlays();
}
function closeStory(restore=true){
  if(!$('story-panel').open)return;$('story-panel').close();state.selected=null;
  try{history.replaceState(null,'',location.pathname+location.search);}catch{}
  document.querySelectorAll('.memory-row').forEach(row=>row.setAttribute('aria-pressed','false'));
  if(restore&&lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
  if(state.online&&streetMap)streetMap.setPadding({top:0,bottom:0,left:0,right:0});renderOverlays();
}

/* Online streets are an optional enhancement. The geographical overview always remains local. */
let streetMap=null,streetToken=0,mapLibrePromise=null;
function loadAsset(tag,url){return new Promise((resolve,reject)=>{
  const el=document.createElement(tag);if(tag==='script'){el.src=url;el.async=true;}else{el.rel='stylesheet';el.href=url;}
  const cleanup=()=>{el.onload=null;el.onerror=null;clearTimeout(timer);};
  const timer=setTimeout(()=>{cleanup();el.remove();reject(new Error('地图组件加载超时'));},8500);
  el.onload=()=>{cleanup();resolve();};el.onerror=()=>{cleanup();el.remove();reject(new Error('地图组件暂时无法连接'));};document.head.append(el);
});}
async function loadMapLibre(){
  if(window.maplibregl)return window.maplibregl;
  if(mapLibrePromise)return mapLibrePromise;
  mapLibrePromise=(async()=>{
    let last;
    for(const base of ['https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.1/dist/','https://unpkg.com/maplibre-gl@5.6.1/dist/']){
      try{await Promise.all([loadAsset('link',base+'maplibre-gl.css'),loadAsset('script',base+'maplibre-gl.js')]);if(window.maplibregl)return window.maplibregl;}catch(e){last=e;}
    }
    throw last||new Error('地图组件没有加载成功');
  })();
  try{return await mapLibrePromise;}finally{mapLibrePromise=null;}
}
function softenStyle(style){
  for(const l of style.layers||[]){
    const id=l.id.toLowerCase();l.paint={...(l.paint||{})};l.layout={...(l.layout||{})};
    if(l.type==='background')l.paint['background-color']='#f2efe2';
    if(l.type==='fill'&&(l['source-layer']==='water'||/^water/.test(id)))l.paint['fill-color']='#dbe6e4';
    if(l.type==='fill'&&/park|wood|forest|grass|landcover/.test(id))l.paint['fill-color']='#dae3ce';
    if(l.type==='fill'&&/building/.test(id))l.paint['fill-color']='#dedbc9';
    if(l.type==='fill-extrusion')l.layout.visibility='none';
    if(l.type==='line'&&/waterway/.test(id))l.paint['line-color']='#bfd3ce';
    if(l.type==='symbol'&&l.layout['text-field']){l.paint['text-color']='#697b61';l.paint['text-halo-color']='#fcfaf0';l.paint['text-halo-width']=1.4;}
    if(l.type==='symbol'&&/poi|housenumber/.test(id))l.layout.visibility='none';
  }
  return style;
}
async function enterStreet(focus=null){
  if(state.loadingStreet){notify('街道底图正在加载，请稍等。');return;}
  if(state.online){if(focus)streetMap.flyTo({center:focus,zoom:13,padding:{right:small()?0:350},duration:reduced?0:800});return;}
  const token=++streetToken;state.loadingStreet=true;$('street-button').dataset.loading='true';$('street-button').setAttribute('aria-busy','true');notify('正在连接在线街道底图，总览仍然可以使用…',0);
  try{
    const ml=await loadMapLibre();if(token!==streetToken)return;
    const response=await fetch('https://tiles.openfreemap.org/styles/positron',{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('街道样式暂时不可用');const style=softenStyle(await response.json());if(token!==streetToken)return;
    const holder=$('online-map');holder.hidden=false;holder.style.opacity='0';holder.style.pointerEvents='none';
    const center=atlas.toGeo([atlas.width/2,atlas.height/2]);const zoom=Math.log2(atlas.camera.s*360/512);
    streetMap=new ml.Map({container:holder,style,center,zoom:Math.max(4,zoom),minZoom:3.5,maxZoom:17,renderWorldCopies:false,attributionControl:false,maxBounds:[[-17,46],[12,65]],pitch:0,bearing:0});
    const thisMap=streetMap;
    thisMap.addControl(new ml.AttributionControl({compact:true,customAttribution:'<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'}),'bottom-right');
    thisMap.dragRotate.disable();thisMap.touchZoomRotate.disableRotation();
    await new Promise((resolve,reject)=>{
      let settled=false;const timer=setTimeout(()=>finish(new Error('街道数据加载超时')),20000);
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);thisMap.off('idle',check);thisMap.off('remove',removed);error?reject(error):resolve();};
      const check=()=>{if(token!==streetToken){finish(new Error('已切回总览'));return;}try{if(thisMap.isStyleLoaded()&&thisMap.queryRenderedFeatures().length)finish();}catch{/* wait for first rendered tiles */}};
      const removed=()=>finish(new Error('已切回总览'));thisMap.on('idle',check);thisMap.on('remove',removed);
    });
    if(token!==streetToken)return;
    state.online=true;$('atlas-svg').hidden=true;$('map-frame').classList.add('is-online');holder.style.opacity='1';holder.style.pointerEvents='auto';
    $('street-button').setAttribute('aria-pressed','true');$('overview-button').setAttribute('aria-pressed','false');
    thisMap.on('move',renderOverlays);thisMap.on('resize',renderOverlays);
    let tileErrors=0;thisMap.on('error',()=>{if(++tileErrors===4&&state.online)notify('部分在线地图资源未加载。可切回「手账总览」继续浏览。',7000);});
    renderOverlays();notify('街道底图已就绪，可以继续放大。');
    if(focus)thisMap.flyTo({center:focus,zoom:13,padding:{right:small()?0:350},duration:reduced?0:900});
  }catch(error){
    if(token!==streetToken)return;
    if(streetMap){streetMap.remove();streetMap=null;}$('online-map').hidden=true;state.online=false;notify('在线街道暂时没有连接成功。已保留手账总览，可稍后再试。',8500);console.warn('[atlas] Optional online layer:',error.message);
  }finally{
    if(token===streetToken){state.loadingStreet=false;delete $('street-button').dataset.loading;$('street-button').removeAttribute('aria-busy');}
  }
}
function enterOverview(){
  ++streetToken;state.loadingStreet=false;delete $('street-button').dataset.loading;$('street-button').removeAttribute('aria-busy');
  if(streetMap){
    if(state.online){const c=streetMap.getCenter(),s=Math.max(atlas.base,Math.min(atlas.base*18,512*2**streetMap.getZoom()/360)),p=project([c.lng,c.lat]);atlas.camera={s,x:atlas.width/2-p[0]*s,y:atlas.height/2-p[1]*s};}
    streetMap.remove();streetMap=null;
  }
  state.online=false;$('online-map').hidden=true;$('atlas-svg').hidden=false;$('map-frame').classList.remove('is-online');$('overview-button').setAttribute('aria-pressed','true');$('street-button').setAttribute('aria-pressed','false');atlas.render();notify('手账总览 · 简化海岸线，不包含街道细节。');
}

async function loadStories(first=false){
  $('data-error').hidden=true;$('retry-data').hidden=true;
  try{state.real=validateMemories(await readJson('./data/memories.json','memories'));if(first)$('show-demos').checked=state.real.length===0;}
  catch(e){$('data-error').textContent=`真实故事未读取成功：${e.message} 已保留演示与地图。`;$('data-error').hidden=false;$('retry-data').hidden=false;}
  refreshCollection();
}
$('close-story').addEventListener('click',()=>closeStory());
$('story-panel').addEventListener('cancel',e=>{e.preventDefault();closeStory();});
$('previous-story').addEventListener('click',()=>{const i=state.filtered.findIndex(m=>m.id===state.selected?.id);if(i>0)openStory(state.filtered[i-1]);});
$('next-story').addEventListener('click',()=>{const i=state.filtered.findIndex(m=>m.id===state.selected?.id);if(i>=0&&i<state.filtered.length-1)openStory(state.filtered[i+1]);});
$('about-button').addEventListener('click',()=>$('about-dialog').showModal());$('sources-button').addEventListener('click',()=>$('about-dialog').showModal());$('close-about').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',e=>{const r=$('about-dialog').getBoundingClientRect();if(e.target===$('about-dialog')&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))$('about-dialog').close();});
$('place-search').addEventListener('input',e=>{state.query=e.target.value;refreshCollection();});
for(const button of document.querySelectorAll('[data-region]'))button.addEventListener('click',()=>{state.region=button.dataset.region;document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));refreshCollection();closeStory(false);if(state.region==='all')resetView();else if(state.filtered.some(m=>m.coordinates)){if(state.online)expandCluster(state.filtered.filter(m=>m.coordinates));else atlas.fit(state.filtered);}});
$('show-demos').addEventListener('change',refreshCollection);$('retry-data').addEventListener('click',()=>loadStories());
$('zoom-in').addEventListener('click',()=>state.online?streetMap.zoomIn({duration:reduced?0:250}):atlas.zoom(1.35));$('zoom-out').addEventListener('click',()=>state.online?streetMap.zoomOut({duration:reduced?0:250}):atlas.zoom(1/1.35));$('reset-map').addEventListener('click',resetView);
$('street-button').addEventListener('click',()=>enterStreet());$('overview-button').addEventListener('click',()=>{if(state.online||state.loadingStreet)enterOverview();});$('story-street').addEventListener('click',()=>{if(state.selected?.coordinates)enterStreet(state.selected.coordinates);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('story-panel').open&&!$('about-dialog').open){e.preventDefault();closeStory();}if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!$('about-dialog').open){e.preventDefault();$('place-search').focus();}});

async function boot(){
  atlas=new OverviewMap();atlas.resize();
  const results=await Promise.allSettled([readJson('./data/uk-overview.geojson','geography'),readJson('./data/demos.json','demos')]);
  if(results[0].status==='fulfilled'){try{atlas.setGeography(results[0].value);notify('点开一个地点，翻看一张演示明信片。',4800);}catch(e){notify(e.message,0);}}
  else notify('总览数据未能读取。请确认 public/data 已完整上传；直接打开请使用单文件预览版。',0);
  if(results[1].status==='fulfilled'){try{state.demos=validateMemories(results[1].value,true);}catch(e){console.warn(e.message);}}
  await loadStories(true);document.documentElement.dataset.state='ready';
  const match=location.hash.match(/^#place=(.+)$/);if(match){let id;try{id=decodeURIComponent(match[1]);}catch{}const m=state.items.find(m=>m.id===id);if(m)openStory(m);}
}
boot().catch(e=>{document.documentElement.dataset.state='error';notify('页面初始化失败。请检查文件是否完整上传。',0);console.error(e);});
