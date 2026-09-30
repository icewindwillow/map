export const LIMIT=15;
export const SCENES=['待分类','外观与全貌','景观与庭院','核心空间','特色展品','人物与故事','生活与后勤'];
export function supplement(project){
  const locked=project.selected.filter(id=>project.items.find(x=>x.id===id)?.locked);
  const chosen=locked.map(id=>project.items.find(x=>x.id===id));
  const candidates=project.items.filter(x=>!locked.includes(x.id)&&!x.rejected);
  const result=[...locked];
  for(const id of recommend([...chosen,...candidates].map(x=>({...x,score:x.locked?10000:x.score})))){
    if(!result.includes(id)&&result.length<LIMIT)result.push(id);
  }
  return result;
}
export function orderPhotos(project){
  return [...project.selected].sort((a,b)=>{
    const scene=id=>{const n=SCENES.indexOf(project.items.find(x=>x.id===id)?.scene);return n>0?n:SCENES.length;};
    return scene(a)-scene(b);
  });
}
export function applyResearch(project,report){
  if(report?.format!=='atlas-photo-research-v1'||report.placeId!==project.placeId||!Array.isArray(report.photos))throw Error('查证结果与当前地点不匹配。');
  const updates=report.photos.map(p=>{
    const item=project.items.find(x=>x.id===p.id);
    if(!item)throw Error('查证结果包含未知照片。');
    for(const k of ['title','note','evidence','researchUrl','scene','identity'])if(p[k]!=null&&(typeof p[k]!=='string'||p[k].length>2000))throw Error('查证结果文本格式不正确。');
    if(p.scene&&!SCENES.includes(p.scene))throw Error('场景类别不正确。');
    if(p.identity&&!['待核实','已确认','仅描述可见画面'].includes(p.identity))throw Error('辨认状态不正确。');
    if(p.researchUrl){const u=new URL(p.researchUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('查证链接须为 HTTPS。');}
    return {item,values:Object.fromEntries(['title','note','evidence','researchUrl','scene','identity'].filter(k=>p[k]!=null).map(k=>[k,p[k]]))};
  });
  for(const {item,values} of updates)Object.assign(item,values,{reviewed:false});
  return project;
}
export function assertPackage(p){
  const fail=m=>{throw new Error(m);};
  if(p?.format!=='atlas-photo-review-v1'||!p.approved||!Array.isArray(p.photos)||!p.photos.length||p.photos.length>LIMIT)fail('请选择已审核的相册包，照片数量须为 1–15 张。');
  if(typeof p.placeId!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(p.placeId))fail('地点 ID 不正确。');
  for(const x of p.photos){
    if(typeof x.caption!=='string'||!x.caption.trim()||x.caption.length>500||!x.reviewed)fail('每张照片都需要说明及审核确认。');
    if(typeof x.data!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(x.data)||x.data.length>273091||!x.data.startsWith('data:image/jpeg;base64,/9j/'))fail('照片必须是 200 KB 以内的 JPEG。');
    if(x.credit!=null&&(typeof x.credit!=='string'||x.credit.length>300))fail('来源文字最多 300 字。');
    if(x.alt!=null&&(typeof x.alt!=='string'||x.alt.length>500))fail('图片名称最多 500 字。');
    if(x.sourceUrl){try{const u=new URL(x.sourceUrl);if(u.protocol!=='https:'||u.username||u.password)fail('来源须为 HTTPS 链接。');}catch{fail('来源须为 HTTPS 链接。');}}
  }
  return p;
}
export function recommend(items){
  const result=[],hashes=[];
  for(const x of [...items].filter(x=>!x.rejected).sort((a,b)=>(b.score||0)-(a.score||0))){
    if(x.hash&&hashes.some(h=>h.length===x.hash.length&&[...h].filter((c,i)=>c!==x.hash[i]).length<7))continue;
    if(x.group&&result.some(y=>y.group===x.group))continue;
    result.push(x);if(x.hash)hashes.push(x.hash);if(result.length===LIMIT)break;
  }
  return result.map(x=>x.id);
}
export function move(ids,from,to){const out=[...ids];if(from<0||to<0||from>=out.length||to>=out.length)return out;out.splice(to,0,out.splice(from,1)[0]);return out;}
export function reviewIssues(project){
  const photos=project.selected.map(id=>project.items.find(x=>x.id===id));
  const issues=[];
  if(!/^[-a-zA-Z0-9_]{1,100}$/.test(project.placeId||''))issues.push('请填写网站中的地点 ID');
  if(!photos.length||photos.length>LIMIT||new Set(project.selected).size!==photos.length)issues.push('相册须包含 1–15 张不重复的照片');
  photos.forEach((x,i)=>{if(!x||!x.title?.trim()||!x.note?.trim()||!x.reviewed||(x.title+'：'+x.note).length>500)issues.push(`第 ${i+1} 张需填写名称、注释并勾选审核`);if(x?.identity==='待核实')issues.push(`第 ${i+1} 张的场景尚待核实`);});
  return issues;
}
