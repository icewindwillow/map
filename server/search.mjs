import {HttpError} from './http.mjs';
import {dbOf} from './reviews.mjs';
const ALIASES={'爱丁堡城堡':'Edinburgh Castle','大英博物馆':'British Museum','流水修道院':'Fountains Abbey','喷泉修道院':'Fountains Abbey','伦敦':'London','爱丁堡':'Edinburgh','牛津':'Oxford','剑桥':'Cambridge','约克':'York','巴斯':'Bath','曼彻斯特':'Manchester','利物浦':'Liverpool','格拉斯哥':'Glasgow','卡迪夫':'Cardiff','贝尔法斯特':'Belfast','巨石阵':'Stonehenge','白金汉宫':'Buckingham Palace','伦敦塔桥':'Tower Bridge','伦敦塔':'Tower of London','威斯敏斯特教堂':'Westminster Abbey','圣保罗大教堂':'St Paul Cathedral','温莎城堡':'Windsor Castle'};
export function searchQuery(value){
  if(typeof value!=='string')throw new HttpError(400,'BAD_SEARCH','请输入地名。');
  const query=value.trim().replace(/\s+/g,' ');
  if(query.length<2||query.length>160||/[\u0000-\u001f]/.test(query))throw new HttpError(400,'BAD_SEARCH','地名请填写 2～160 个字符。');
  return {query,upstreamQuery:ALIASES[query]||query};
}
const str=(v,n=200)=>typeof v==='string'?v.slice(0,n):'';
export function normalizeResults(data){
  if(!data||!Array.isArray(data.features))throw new HttpError(502,'SEARCH_BAD_RESPONSE','地名服务返回格式异常，请稍后重试。');
  const seen=new Set(),results=[];
  for(const feature of data.features.slice(0,30)){
    const p=feature?.properties||{},c=feature?.geometry?.coordinates;
    if(feature?.geometry?.type!=='Point'||!Array.isArray(c)||c.length!==2||!c.every(Number.isFinite)||c[0]<-15||c[0]>12||c[1]<46||c[1]>65||String(p.countrycode).toUpperCase()!=='GB')continue;
    const name=str(p.name,160)||str(p.street,160);if(!name)continue;
    const key=`${name}|${c.map(x=>x.toFixed(4)).join(',')}`;if(seen.has(key))continue;seen.add(key);
    const region={England:'england',Scotland:'scotland',Wales:'wales','Northern Ireland':'northernIreland'}[p.state]||null;
    const address=[p.housenumber,p.street,p.city||p.town||p.district,p.county,p.state,p.postcode].filter(v=>typeof v==='string').filter((v,i,a)=>a.indexOf(v)===i).join(', ').slice(0,200);
    const osmType={N:'node',W:'way',R:'relation'}[p.osm_type],osmId=Number(p.osm_id);
    const sourceUrl=osmType&&Number.isSafeInteger(osmId)&&osmId>0?`https://www.openstreetmap.org/${osmType}/${osmId}`:'https://www.openstreetmap.org/copyright';
    results.push({name,address,region,coordinates:c,kind:str(p.osm_value,80),sourceUrl});
    if(results.length===8)break;
  }
  return results;
}
export async function searchPlaces(env,body,{fetcher=fetch}={}){
  const {query,upstreamQuery}=searchQuery(body?.query),db=dbOf(env);
  // Explicit authenticated searches only; never forward tokens, emails or story data.
  await db.prepare('CREATE TABLE IF NOT EXISTS place_search_cache (query TEXT PRIMARY KEY, results TEXT NOT NULL, fetched_at INTEGER NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS place_search_gate (id INTEGER PRIMARY KEY, owner TEXT NOT NULL, next_at INTEGER NOT NULL)').run();
  const key='photon-gb-en-v1:'+upstreamQuery.toLowerCase();
  const cached=await db.prepare("SELECT results FROM place_search_cache WHERE query=? AND fetched_at>CAST(strftime('%s','now') AS INTEGER)-604800").bind(key).first();
  if(cached)return {query,upstreamQuery,results:JSON.parse(cached.results),cached:true};
  const owner=crypto.randomUUID();
  const lease=await db.prepare("INSERT INTO place_search_gate (id,owner,next_at) VALUES (1,?,CAST(strftime('%s','now') AS INTEGER)+30) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,next_at=excluded.next_at WHERE place_search_gate.next_at<=CAST(strftime('%s','now') AS INTEGER) RETURNING id").bind(owner).first();
  if(!lease)throw new HttpError(429,'SEARCH_BUSY','搜索稍忙，请等待几秒后再点击搜索。');
  try{
    const url=new URL('https://photon.komoot.io/api/');url.search=new URLSearchParams({q:upstreamQuery,limit:'8',lang:'en',countrycode:'GB',bbox:'-9.1,49.65,2.25,61'}).toString();
    let response;
    try{response=await fetcher(url.href,{headers:{Accept:'application/json','User-Agent':'IrisMemoryAtlas/0.5.1 (+https://iris.icewindwillow.cn/; https://github.com/icewindwillow/map)'},signal:AbortSignal.timeout(12000),redirect:'manual'});}catch{throw new HttpError(502,'SEARCH_UNAVAILABLE','地名服务暂时无法连接，输入已保留。请稍后重试，或用地图选点。');}
    if(!response.ok)throw new HttpError(response.status===429?429:502,'SEARCH_UNAVAILABLE','地名服务暂时繁忙，请稍后重试。');
    let data;try{data=await response.json();}catch{throw new HttpError(502,'SEARCH_BAD_RESPONSE','地名服务没有返回有效结果，请稍后重试。');}
    const results=normalizeResults(data);
    await db.prepare("INSERT INTO place_search_cache (query,results,fetched_at) VALUES (?,?,CAST(strftime('%s','now') AS INTEGER)) ON CONFLICT(query) DO UPDATE SET results=excluded.results,fetched_at=excluded.fetched_at").bind(key,JSON.stringify(results)).run();
    return {query,upstreamQuery,results,cached:false};
  }finally{await db.prepare("UPDATE place_search_gate SET next_at=CAST(strftime('%s','now') AS INTEGER)+2 WHERE id=1 AND owner=?").bind(owner).run();}
}
