import {normalizeVisits} from './visits.v0.7.js';
// Legacy categories are normalized without changing any other author content.
export const CATEGORIES=["修道院","教堂","墓地","城堡","宫殿","城市","博物馆","展览"];
const aliases={"美术馆":"博物馆","城堡与桥梁":"城堡","庄园":"宫殿","纪念碑":"展览","剧院":"展览","印刷工坊":"展览","故居":"博物馆","图书馆":"展览"};
const known={
  "greyfriars-kirkyard": "墓地",
  "st-marys-episcopal-cathedral": "教堂",
  "rosslyn-chapel": "教堂",
  "glasgow-necropolis": "墓地",
  "edinburgh-castle": "城堡",
  "stirling-castle": "城堡",
  "tantallon-castle": "城堡",
  "scottish-national-portrait-gallery": "博物馆",
  "national-museum-of-scotland": "博物馆",
  "scottish-national-gallery": "博物馆",
  "peoples-story-museum": "博物馆",
  "royal-yacht-britannia": "博物馆",
  "surgeons-hall-museums": "博物馆",
  "wallace-monument": "展览",
  "oxford-castle": "城堡",
  "blenheim-palace": "宫殿",
  "sheldonian-theatre": "展览",
  "bodleian-bibliographical-press": "展览",
  "agatha-christie-house": "博物馆",
  "bodleian-library": "展览",
  "history-of-science-museum": "博物馆",
  "york-minster": "教堂",
  "whitby-abbey": "修道院",
  "ripon-cathedral": "教堂",
  "warwick-castle": "城堡",
  "harewood-house": "宫殿",
  "alnwick-castle": "城堡",
  "knaresborough-castle-viaduct": "城堡",
  "royal-armouries-leeds": "博物馆",
  "york-castle-museum": "博物馆",
  "st-pauls-cathedral": "教堂",
  "westminster-abbey": "教堂",
  "winchester-cathedral": "教堂",
  "windsor-castle": "城堡",
  "palace-of-westminster": "宫殿",
  "tower-of-london": "城堡",
  "british-museum": "博物馆",
  "national-gallery": "博物馆",
  "queens-wardrobe-exhibition": "展览",
  "fountains-abbey": "修道院"
};
export function categoryOf(value,id){return CATEGORIES.includes(value)?value:aliases[value]||known[id]||'未分类';}
export function normalizeCategory(place){return place?normalizeVisits({...place,category:categoryOf(place.category,place.id)}):place;}
