import {locations} from './city-seeds.v0.8.js';
// City labels complement coordinates; they never move a pin or replace author text.
const cities = {Edinburgh:'爱丁堡',Oxford:'牛津',London:'伦敦',Glasgow:'格拉斯哥',Stirling:'斯特灵',Roslin:'罗斯林', 'North Berwick':'北贝里克',Woodstock:'伍德斯托克',York:'约克',Whitby:'惠特比',Ripon:'里彭',Warwick:'华威',Harewood:'哈伍德',Alnwick:'阿尼克',Knaresborough:'纳尔斯伯勒',Leeds:'利兹',Winchester:'温切斯特',Windsor:'温莎',Wallingford:'沃灵福德','St Andrews':'圣安德鲁斯'};
export function cityFromAddress(address='') { return Object.entries(cities).find(([name])=>new RegExp(`\\b${name}\\b`,'i').test(address))?.[1]||''; }
export function normalizeDetails(place) {
  if (!place) return place;
  return {...place,city:typeof place.city==='string'?place.city:place.id==='queens-wardrobe-exhibition'?'伦敦':cityFromAddress(place.locationLabel)||cityFromAddress(locations[place.id]),officialIntroduction:place.officialIntroduction||'',officialSource:place.officialSource||''};
}
