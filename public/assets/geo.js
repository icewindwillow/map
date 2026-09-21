/** Pure data and projection utilities. Coordinates always use [longitude, latitude]. */
export const UK_BOUNDS = [-9.1, 49.65, 2.25, 61.0];
export const REGIONS = {england:'英格兰',scotland:'苏格兰',wales:'威尔士',northernIreland:'北爱尔兰'};
export function project([lng, lat]) {
  const y = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return [lng, -Math.log(Math.tan(Math.PI/4 + y/2))*180/Math.PI];
}
export function unproject([x, y]) { return [x, (2*Math.atan(Math.exp(-y*Math.PI/180))-Math.PI/2)*180/Math.PI]; }
export function validCoordinates(c) {
  return Array.isArray(c) && c.length===2 && c.every(Number.isFinite) && c[0]>=-180 && c[0]<=180 && c[1]>=-85 && c[1]<=85;
}
export function validateMemories(data, demos=false) {
  if (!data || data.schemaVersion!==1 || !Array.isArray(data.memories)) throw new Error('故事文件格式不正确，需要 schemaVersion: 1 与 memories 数组。');
  const ids = new Set();
  return data.memories.map(m => {
    if (!m || typeof m.id!=='string' || !m.id.trim() || ids.has(m.id) || typeof m.title!=='string' || !m.title.trim()) throw new Error('故事 id 必须唯一，id 和 title 不能为空。');
    ids.add(m.id);
    for (const key of ['place','placeEn','date','description','region','category','photo','photoAlt','locationPrecision']) {
      if(m[key]!=null && typeof m[key]!=='string') throw new Error(`故事 ${m.id} 的 ${key} 必须是文字。`);
    }
    if(m.coordinates!=null && !validCoordinates(m.coordinates)) throw new Error(`故事 ${m.id} 的坐标格式错误，请使用 [经度, 纬度]。`);
    if(m.region && !Object.hasOwn(REGIONS,m.region)) throw new Error(`故事 ${m.id} 的 region 不正确。`);
    if(m.photo && (!/^\.\/assets\/[a-zA-Z0-9_./%-]+\.(png|jpe?g|webp|avif)$/i.test(m.photo) || m.photo.includes('..'))) throw new Error(`故事 ${m.id} 的照片应保存在 ./assets/ 中。`);
    return {...m, demo:!!demos};
  });
}
export function filterMemories(items, region='all', query='') {
  const q=query.trim().toLocaleLowerCase();
  return items.filter(m=>(region==='all'||m.region===region)&&(!q||[m.title,m.place,m.placeEn,m.description,m.category,REGIONS[m.region]].filter(Boolean).join(' ').toLocaleLowerCase().includes(q)));
}
/** Stable greedy clustering in screen pixels. Original coordinates are never altered. */
export function clusterPoints(items, screen, radius=31) {
  const groups=[];
  for(const m of items) {
    if(!m.coordinates) continue;
    const p=screen(m.coordinates);
    let g=groups.find(g=>Math.hypot(g.x-p[0],g.y-p[1])<radius);
    if(g){g.items.push(m);g.x+=(p[0]-g.x)/g.items.length;g.y+=(p[1]-g.y)/g.items.length;}
    else groups.push({x:p[0],y:p[1],items:[m]});
  }
  return groups;
}
export function featurePath(feature) {
  const line=(coords,close=false)=>coords.map((c,i)=>{const p=project(c);return `${i?'L':'M'}${p[0].toFixed(5)},${p[1].toFixed(5)}`;}).join('')+(close?'Z':'');
  const {type,coordinates}=feature.geometry;
  if(type==='Polygon') return coordinates.map(c=>line(c,true)).join('');
  if(type==='MultiPolygon') return coordinates.flatMap(p=>p.map(c=>line(c,true))).join('');
  if(type==='LineString') return line(coordinates);
  return '';
}
