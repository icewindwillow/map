import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(new URL('../public/data/memories.json',import.meta.url)));
const originalEdinburgh=['greyfriars-kirkyard','st-marys-episcopal-cathedral','edinburgh-castle','scottish-national-portrait-gallery','national-museum-of-scotland','scottish-national-gallery','peoples-story-museum','surgeons-hall-museums','royal-yacht-britannia'];
fixture.memories=fixture.memories.filter(p=>p.locationLabel!=='Edinburgh'||originalEdinburgh.includes(p.id));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/places',r=>r.fulfill({json:{ok:true,schemaVersion:1,memories:[]}}));
 await page.route('**/data/memories.json?*',r=>r.fulfill({json:fixture}));
 await page.goto('http://127.0.0.1:8794/');await page.waitForFunction(()=>document.documentElement.dataset.state==='ready');
 await page.locator('#place-search').fill('Edinburgh');
 assert.equal(await page.locator('.memory-row').count(),9);
 for(let i=0;i<5;i++){const cluster=page.locator('.map-marker.cluster[data-marker-id*="greyfriars-kirkyard"]');if(!await cluster.count())break;await cluster.locator('.pin-hit').click();}
 assert.equal(await page.locator('.map-marker:not(.cluster)[data-marker-id="greyfriars-kirkyard"]').count(),1);
 const ids=['greyfriars-kirkyard','st-marys-episcopal-cathedral','edinburgh-castle','scottish-national-portrait-gallery','national-museum-of-scotland','scottish-national-gallery','peoples-story-museum','surgeons-hall-museums'];
 if(width>760){for(const id of ids)assert.equal(await page.locator(`.map-marker:not(.cluster)[data-marker-id="${id}"]`).count(),1);}
 else {for(let i=0;i<5;i++){const clusters=page.locator('.map-marker.cluster');if(!await clusters.count())break;const before=await clusters.first().getAttribute('data-marker-id');await clusters.first().locator('.pin-hit').click();assert.equal(await page.locator(`.map-marker.cluster[data-marker-id="${before}"]`).count(),0);}}
 await page.screenshot({path:`/private/tmp/map-v05-browser/edinburgh-${width}.png`,fullPage:true});
 await page.locator('#place-search').fill('Bodleian');await page.locator('#reset-map').click();
 await page.locator('.map-marker.cluster .pin-hit').click();await page.locator('.cluster-dialog[open]').waitFor();
 assert.equal(await page.locator('.cluster-choice').count(),2);await page.locator('.cluster-dialog').getByRole('button',{name:/书目印刷工坊/}).click();
 assert((await page.locator('#story-place').innerText()).includes('书目印刷工坊'));
 assert.deepEqual(errors,[]);await page.close();
}
await browser.close();console.log('PASS city clusters split into 8 individual Edinburgh landmarks on desktop/mobile; shared library location offers both records.');
