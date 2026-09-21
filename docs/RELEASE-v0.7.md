# v0.7 — reviews, categories and dated itinerary

- Site name: 谢曼殊的英国旅行. Blank/new author input defaults to 谢曼殊; existing signatures remain unchanged.
- Short review uses existing review.comment (60 characters recommended, legacy 10000 limit retained). Long review uses existing description (10000 characters). No text is automatically split, rewritten or truncated. Public long review is a full-width reading section below the album, retaining paragraph breaks.
- Exactly eight selectable categories: 修道院、教堂、墓地、城堡、宫殿、城市、博物馆、展览. Each has a line icon and existing muted rating palette.
- Old art galleries map to 博物馆; library, printing workshop, theatre and monument visits group under 展览; historic house museums under 博物馆; Harewood under 宫殿; city walls and urban garden under 城市. Editors can change these categories. Existing valid choices remain authoritative.
- User itinerary contains 74 visits to 73 unique places. Warwick Castle retains July 19 and August 8 under one place. The previous Knaresborough place is preserved without an invented date. Total collection: 74 places (73 bundled list entries plus existing Fountains Abbey).
- Added places have no fabricated photos, ratings or prose. Coordinates are manually selected from matching GB OpenStreetMap / Photon results; source links are stored per place. Oxford textiles exhibition shares the confirmed natural history museum venue; co-located markers use the existing chooser.
- Ambiguous venues stay unpinned with date/name preserved. Current pending records are discoverable in the editor and public list.
- D1 reads normalize old unsupported categories and fill missing itinerary dates in memory. Existing published/draft JSON, revisions, signatures, photos and review text are not overwritten by deployment. On the next explicit save, normalized metadata persists with optimistic revision checking. No database migration or dashboard configuration is required.
- visitDates supports multiple dates; strict server validation and editor roundtrip. Existing date remains the primary visit date. Publication timestamps are unchanged.
- Versioned v0.7 browser assets avoid mixed old code caches.

Validation: unit tests include non-mutating cloud legacy overlays, full text/photo preservation, date validation, repeat visits and exact taxonomy. Local browser tests exercise default author, short/long draft reload and publish, repeated date persistence, category selection/filter, photo upload, desktop and mobile reading, no horizontal overflow. All mutations use an isolated local SQLite fixture, not production.
