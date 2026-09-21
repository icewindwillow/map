// Local fixture only; no production writes.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8794/#place=greyfriars-kirkyard');await page.locator('#story-panel[open]').waitFor();
 assert.equal(await page.locator('#story-city').textContent(),'爱丁堡');assert(await page.locator('#story-writing').isHidden());
 await page.locator('#read-guests').click();await page.locator('#guest-name').fill('测试游客 <img>');await page.locator('#guest-rating').selectOption('4');await page.locator('#guest-comment').fill('游客评论，和作者内容分开。<script>bad()</script>');await page.locator('.guest-form button').click();
 await page.waitForFunction(()=>document.querySelector('.guest-status').textContent.includes('已发表'));
 assert.equal(await page.locator('.guest-card').count(),1);assert.equal(await page.locator('.guest-card img,.guest-card script').count(),0);
 assert.match(await page.locator('.guest-summary').textContent(),/4.0 \/ 5/);
 await page.screenshot({path:'/private/tmp/map-v05-browser/guests-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#read-guests').click();await page.screenshot({path:'/private/tmp/map-v05-browser/guests-mobile.png'});assert(await page.evaluate(()=>document.querySelector('#story-scroll').scrollWidth<=document.querySelector('#story-scroll').clientWidth+1));
 const admin=await browser.newContext({viewport:{width:1440,height:1000}});await admin.addCookies([{name:'atlas_fixture_author',value:'1',url:'http://127.0.0.1:8794'}]);const editor=await admin.newPage();editor.on('pageerror',e=>errors.push(e.message));editor.on('dialog',d=>d.accept());await editor.goto('http://127.0.0.1:8794/author/?place=greyfriars-kirkyard');await editor.waitForFunction(()=>!document.querySelector('#fields').disabled);
 assert.equal(await editor.locator('#city').inputValue(),'爱丁堡');await editor.locator('#official-introduction').fill('官方背景介绍\n建筑与历史。');await editor.locator('#official-source').fill('https://example.com/official');await editor.locator('#description').fill('这是作者长评，不是官方介绍。');await editor.locator('#place-form button[type=submit]').click();await editor.waitForFunction(()=>document.querySelector('#message').textContent.includes('已发布'));
 await editor.locator('.guest-delete').click();await editor.waitForFunction(()=>document.querySelector('#guest-moderation').textContent.includes('0 条游客评价'));
 await page.reload();await page.locator('#story-panel[open]').waitFor();await page.waitForFunction(()=>document.querySelector('#official-text').textContent.includes('建筑与历史'));
 assert.equal(await page.locator('#story-description').textContent(),'这是作者长评，不是官方介绍。');assert(await page.locator('#story-writing').isVisible());await page.locator('#read-official').click();assert.equal(await page.locator('#official-link').getAttribute('href'),'https://example.com/official');
 await page.waitForFunction(()=>document.querySelector('.guest-summary').textContent.includes('还没有'));assert.equal(await page.locator('.guest-card').count(),0);
 await page.locator('#close-story').click();await page.locator('#city-filter').selectOption('爱丁堡');assert((await page.locator('.memory-row').count())>10);assert(!(await page.locator('.memory-row[data-id="british-museum"]').count()));
 assert.deepEqual(errors,[]);console.log('PASS: visitor publish, literal text safety, mobile layout, author delete, averages, official/long review separation, city filtering.');
}finally{await browser.close();}
