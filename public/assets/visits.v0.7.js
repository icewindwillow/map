// User-supplied visit dates. Publication timestamps remain separate.
export const VISIT_DATES={
  "natural-history-museum": [
    "2026-04-14"
  ],
  "schwarzman-centre": [
    "2026-04-25"
  ],
  "st-sepulchres-cemetery": [
    "2026-05-09"
  ],
  "sheldonian-theatre": [
    "2026-05-12"
  ],
  "bodleian-bibliographical-press": [
    "2026-05-16"
  ],
  "textiles-exhibition": [
    "2026-05-16"
  ],
  "oxford-free-art-exhibition": [
    "2026-05-21"
  ],
  "oxford-castle": [
    "2026-05-23"
  ],
  "wallingford-castle": [
    "2026-05-24"
  ],
  "agatha-christie-house": [
    "2026-05-24"
  ],
  "st-pauls-cathedral": [
    "2026-06-06"
  ],
  "st-dunstan-east": [
    "2026-06-06"
  ],
  "british-museum": [
    "2026-06-14"
  ],
  "royal-mews": [
    "2026-06-21"
  ],
  "national-gallery": [
    "2026-06-21"
  ],
  "queens-wardrobe-exhibition": [
    "2026-06-21"
  ],
  "windsor-castle": [
    "2026-06-27"
  ],
  "blenheim-palace": [
    "2026-07-05"
  ],
  "bodleian-library": [
    "2026-07-09"
  ],
  "westminster-abbey": [
    "2026-07-11"
  ],
  "palace-of-westminster": [
    "2026-07-11"
  ],
  "churchill-war-rooms": [
    "2026-07-11"
  ],
  "tower-of-london": [
    "2026-07-12"
  ],
  "st-cross-church": [
    "2026-07-18"
  ],
  "winchester-cathedral": [
    "2026-07-18"
  ],
  "warwick-castle": [
    "2026-07-19",
    "2026-08-08"
  ],
  "hampton-court-palace": [
    "2026-07-26"
  ],
  "history-of-science-museum": [
    "2026-08-05"
  ],
  "york-minster": [
    "2026-08-12"
  ],
  "whitby-abbey": [
    "2026-08-13"
  ],
  "harewood-house": [
    "2026-08-13"
  ],
  "royal-armouries-leeds": [
    "2026-08-13"
  ],
  "holy-trinity-church": [
    "2026-08-16"
  ],
  "york-city-walls": [
    "2026-08-16"
  ],
  "jorvik-viking-centre": [
    "2026-08-17"
  ],
  "york-castle-museum": [
    "2026-08-18"
  ],
  "fountains-abbey": [
    "2026-08-19"
  ],
  "ripon-cathedral": [
    "2026-08-19"
  ],
  "greyfriars-kirkyard": [
    "2026-08-21"
  ],
  "national-library-scotland": [
    "2026-08-22"
  ],
  "scottish-national-portrait-gallery": [
    "2026-08-22"
  ],
  "old-saint-pauls": [
    "2026-08-23"
  ],
  "st-marys-catholic-cathedral": [
    "2026-08-23"
  ],
  "st-marys-episcopal-cathedral": [
    "2026-08-23"
  ],
  "national-museum-of-scotland": [
    "2026-08-23"
  ],
  "canongate-kirkyard": [
    "2026-08-25"
  ],
  "museum-of-edinburgh": [
    "2026-08-25"
  ],
  "peoples-story-museum": [
    "2026-08-25"
  ],
  "edinburgh-castle": [
    "2026-08-26"
  ],
  "royal-yacht-britannia": [
    "2026-08-27"
  ],
  "surgeons-hall-museums": [
    "2026-08-30"
  ],
  "scottish-national-gallery": [
    "2026-08-30"
  ],
  "duddingston-kirk": [
    "2026-09-01"
  ],
  "rosslyn-chapel": [
    "2026-09-01"
  ],
  "craigmillar-castle": [
    "2026-09-01"
  ],
  "glasgow-necropolis": [
    "2026-09-02"
  ],
  "glasgow-cathedral": [
    "2026-09-02"
  ],
  "kelvingrove-museum": [
    "2026-09-02"
  ],
  "st-mungo-museum": [
    "2026-09-02"
  ],
  "old-calton-burial-ground": [
    "2026-09-03"
  ],
  "alnwick-castle": [
    "2026-09-03"
  ],
  "st-andrews-castle": [
    "2026-09-05"
  ],
  "wardlaw-museum": [
    "2026-09-05"
  ],
  "stirling-castle": [
    "2026-09-06"
  ],
  "wallace-monument": [
    "2026-09-06"
  ],
  "tantallon-castle": [
    "2026-09-07"
  ],
  "writers-museum": [
    "2026-09-08"
  ],
  "merchant-adventurers-hall": [
    "2026-08-16"
  ],
  "barley-hall": [
    "2026-08-17"
  ],
  "fairfax-house": [
    "2026-08-18"
  ],
  "gladstones-land": [
    "2026-08-31"
  ],
  "dr-neils-garden": [
    "2026-09-01"
  ],
  "provands-lordship": [
    "2026-09-02"
  ]
};
export function normalizeVisits(place){if(!place)return place;const visits=place.visitDates??VISIT_DATES[place.id]??(place.date?[place.date]:[]);return {...place,date:place.date||visits[0]||'',visitDates:visits};}
