import {HttpError} from './http.mjs';
import {dbOf} from './reviews.mjs';
import {listPlaces} from './places.mjs';
import {locations} from '../public/assets/city-seeds.v0.8.js';
export const VISITOR_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS visitor_reviews (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, place_id TEXT NOT NULL, name TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT NOT NULL, created_at TEXT NOT NULL, deleted_at TEXT, deleted_by TEXT)`,
  `CREATE INDEX IF NOT EXISTS visitor_place ON visitor_reviews(place_id,deleted_at,seq)`,
  `CREATE TABLE IF NOT EXISTS visitor_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)`
];
async function database(env) { const db=dbOf(env);for(const sql of VISITOR_SCHEMA)await db.prepare(sql).run();return db; }
async function known(env,id) {
  if(typeof id!=='string'||!id||id.length>100||(!Object.hasOwn(locations,id)&&!(await listPlaces(env)).some(p=>p.id===id)))throw new HttpError(404,'UNKNOWN_PLACE','这个地点尚未发布。');
}
export async function visitorList(env,place,before='') {
  await known(env,place);
  if(before&&!/^\d{1,15}$/.test(before))throw new HttpError(400,'BAD_CURSOR','分页参数不正确。');
  const db=await database(env);
  const summary=await db.prepare('SELECT COUNT(*) AS count,AVG(rating) AS average FROM visitor_reviews WHERE place_id=? AND deleted_at IS NULL').bind(place).first();
  const {results}=await db.prepare('SELECT seq,id,name,rating,comment,created_at AS createdAt FROM visitor_reviews WHERE place_id=? AND deleted_at IS NULL AND seq<? ORDER BY seq DESC LIMIT 21').bind(place,before?Number(before):Number.MAX_SAFE_INTEGER).all();
  const more=results.length>20, reviews=results.slice(0,20);
  return {summary,reviews:reviews.map(({seq,...row})=>row),next:more?String(reviews.at(-1).seq):null};
}
export async function addVisitor(env,request,body) {
  const origin=new URL(request.url).origin;
  if(request.headers.get('Origin')!==origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new HttpError(403,'ORIGIN_REQUIRED','请在本站页面提交评价。');
  if(!body||typeof body!=='object'||typeof body.id!=='string'||! /^[a-f0-9-]{36}$/.test(body.id)||typeof body.name!=='string'||!body.name.trim()||body.name.length>80||typeof body.comment!=='string'||body.comment.length>2000||!Number.isInteger(body.rating)||body.rating<1||body.rating>5||body.website)throw new HttpError(400,'BAD_REVIEW','请填写名字、1～5 星评分和 2000 字以内的评价。');
  await known(env,body.place);
  const db=await database(env),name=body.name.trim(),comment=body.comment.trim();
  const prior=await db.prepare('SELECT * FROM visitor_reviews WHERE id=?').bind(body.id).first();
  if(prior){if(prior.deleted_at||prior.place_id!==body.place||prior.name!==name||prior.comment!==comment||prior.rating!==body.rating)throw new HttpError(409,'REVIEW_CONFLICT','该提交已处理，请刷新后重试。');return {id:prior.id};}
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip)throw new HttpError(503,'RATE_LIMIT_UNAVAILABLE','暂时不能提交，请稍后再试。');
  const now=Date.now(),day=Math.floor(now/86400000);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${day}:${origin}:${ip}`))),b=>b.toString(16).padStart(2,'0')).join('');
  for(const [period,maximum] of [[Math.floor(now/60000),1],[`day-${day}`,20]]) {
    const granted=await db.prepare('INSERT INTO visitor_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(`${hash}:${period}`,now+86400000,maximum).first();
    if(!granted)throw new HttpError(429,'TOO_MANY_REVIEWS','提交太频繁，请稍后再试（每分钟 1 次，每天最多 20 次）。');
  }
  await db.prepare('DELETE FROM visitor_limits WHERE expires<?').bind(now).run();
  await db.prepare('INSERT INTO visitor_reviews(id,place_id,name,rating,comment,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(body.id,body.place,name,body.rating,comment,new Date(now).toISOString()).run();
  return {id:body.id};
}
export async function deleteVisitor(env,body,author) {
  if(typeof body?.id!=='string'||body.id.length>100)throw new HttpError(400,'BAD_REVIEW','请选择一条游客评论。');
  const db=await database(env);
  const row=await db.prepare('UPDATE visitor_reviews SET deleted_at=?,deleted_by=? WHERE id=? AND deleted_at IS NULL RETURNING id').bind(new Date().toISOString(),author.email,body.id).first();
  if(!row)throw new HttpError(404,'NOT_FOUND','这条游客评论已删除或不存在。');
  return {id:row.id};
}
