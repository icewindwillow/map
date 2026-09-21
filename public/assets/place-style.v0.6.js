export const CATEGORIES=['博物馆','修道院','城堡','教堂','美术馆','其他'];
export function categoryOf(value){if(CATEGORIES.includes(value))return value;return ({'宫殿':'城堡','城堡与桥梁':'城堡','展览':'博物馆'})[value]||'其他';}
export function ratingTone(value){return typeof value!=='number'||!Number.isFinite(value)||value<0||value>5?'unrated':value<2?'clay':value<3.5?'ochre':value<4.5?'sage':'forest';}
const paths={
 '博物馆':'M3 9 12 4l9 5H3Zm2 3v7m5-7v7m4-7v7m5-7v7M3 21h18',
 '修道院':'M4 21V9l4-4 4 4v12M4 12h8M7 21v-5h2v5m3-9h8v9m-5 0v-5h2v5M7 9h2m7 0V5m-2 2h4',
 '城堡':'M4 21V5h3v3h3V5h4v3h3V5h3v16H4Zm5 0v-5a3 3 0 0 1 6 0v5M7 11v2m10-2v2',
 '教堂':'M5 21V12l7-6 7 6v9H5Zm5 0v-6h4v6M12 2v4m-2-2h4M3 12h2m14 0h2',
 '美术馆':'M3 5h18v15H3V5Zm2 13 5-6 4 4 3-3 3 5M16 8h.01',
 '其他':'M18 10c0 5-6 11-6 11S6 15 6 10a6 6 0 1 1 12 0Zm-4 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0'
};
export function categoryIcon(value){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','category-icon');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(ns,'path');path.setAttribute('d',paths[categoryOf(value)]);svg.append(path);return svg;}
