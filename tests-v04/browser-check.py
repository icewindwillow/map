"""Offline Chromium UI tests, bridged to local signed-JWT/SQLite fixture server.
Browser navigation/network is unavailable in this runtime. Production files are
injected without imports, supplied photographs embedded, fetch bridged to loopback.
This is NOT a real Cloudflare Access, D1 or online OSM acceptance test.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, base64, re, urllib.request, urllib.error, os
root=Path(__file__).resolve().parents[1];pub=root/'public';out=Path(os.environ.get('ATLAS_TEST_OUTPUT',str(root/'test-results-v04')));out.mkdir(exist_ok=True)
results=[];errors=[]
def response(path,method='GET',headers=None,body=None,author=False):
 headers=dict(headers or {});headers['Referer']='https://iris.icewindwillow.cn/'
 if author:headers['Cookie']='atlas_fixture_author=1'
 if method not in ['GET','HEAD']:headers['Origin']='https://iris.icewindwillow.cn';headers['Sec-Fetch-Site']='same-origin'
 req=urllib.request.Request('http://127.0.0.1:8794'+path,method=method,headers=headers,data=body.encode() if isinstance(body,str) else body)
 try:r=urllib.request.urlopen(req,timeout=20)
 except urllib.error.HTTPError as e:r=e
 return {'status':r.status,'headers':dict(r.headers),'body':base64.b64encode(r.read()).decode()}
def payload(r):return json.loads(base64.b64decode(r['body']))
assets={}
for f in (pub/'assets/photos').rglob('*.jpg'):
 src='./'+str(f.relative_to(pub));assets[src]='data:image/jpeg;base64,'+base64.b64encode(f.read_bytes()).decode();assets['/'+str(f.relative_to(pub))]=assets[src]
embed={'geography':json.loads((pub/'data/uk-overview.geojson').read_text()),'demos':json.loads((pub/'data/demos.json').read_text()),'firstMemory':json.loads((pub/'data/fountains-abbey.v0.3.json').read_text()),'memories':json.loads((pub/'data/memories.json').read_text()),'assets':assets}
def jsfile(name):
 text=(pub/'assets'/name).read_text();text=re.sub(r'^import .*?;\n','',text,flags=re.M);return re.sub(r'\bexport (?=(?:async )?(?:function|class|const|let))','',text)
def html(author=False):
 text=(pub/('author/index.html' if author else 'index.html')).read_text()
 text=re.sub(r'<script[^>]*src=[^>]*></script>','',text)
 text=re.sub(r'<link[^>]*>','',text)
 css=(pub/'assets'/('author.v0.4.css' if author else 'style.v0.4.css')).read_text()
 source=jsfile('geo.v0.4.js')+'\n'+('' if author else jsfile('streets.v0.4.js'))+'\n'+jsfile('author.v0.4.js' if author else 'app.v0.4.js')
 for src,value in assets.items():
  if src.startswith('/'):text=text.replace('src="'+src+'"','src="'+value+'"')
 bridge='''window.fetch=async(input,options={})=>{const data=await window.localFixtureFetch({url:String(input),method:options.method||'GET',headers:options.headers||{},body:options.body||null});const bytes=Uint8Array.from(atob(data.body),c=>c.charCodeAt(0));return new Response([204,304].includes(data.status)?null:bytes,{status:data.status,headers:data.headers});};'''
 emb='' if author else '<script id="atlas-embedded" type="application/json">'+json.dumps(embed,ensure_ascii=False).replace('<','\\u003c')+'</script>'
 text=text.replace('</head>','<style>'+css+'</style></head>')
 return text.replace('</body>',emb+'<script>'+bridge+'</script><script type="module">'+source+'</script></body>')
with sync_playwright() as p:
 executable=os.environ.get('CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 def make(width=1440,height=1000,author=False):
  context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=width<700,has_touch=width<700)
  context.expose_binding('localFixtureFetch',lambda source,args:response(args['url'],args.get('method','GET'),args.get('headers'),args.get('body'),author))
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.set_content(html(author),wait_until='domcontentloaded')
  if author:page.wait_for_function('!document.querySelector("#editor-fields").disabled',timeout=12000)
  else:page.wait_for_selector('html[data-state="ready"]');page.wait_for_function('document.querySelector("#cloud-read-status").textContent.includes("云端已发布")')
  return context,page
 context,page=make()
 assert page.locator('.memory-row').count()==1
 page.screenshot(path=str(out/'overview-desktop.png'),full_page=True)
 page.locator('.memory-row').click();assert '5.0' in page.locator('#story-rating').inner_text();assert page.locator('.photo-thumb').count()==2
 page.screenshot(path=str(out/'album-desktop.png'),full_page=True)
 page.locator('#story-street').click();page.wait_for_selector('#map-frame.is-online',timeout=12000)
 assert page.locator('#street-attribution').is_visible();assert page.locator('.street-tile-image').count()>0
 assert page.locator('.map-marker').count()>0
 page.locator('#zoom-in').click();page.wait_for_timeout(300);page.locator('#overview-button').click();assert not page.locator('#map-frame').evaluate('(e)=>e.classList.contains("is-online")')
 results.append({'name':'desktop map, album, street switch with clearly labelled fixture tiles, zoom, overview return','passed':True})
 assert response('/author/api/review','POST',{'Content-Type':'application/json'},'{}')['status']==401
 assert response('/author/')['status']==401
 results.append({'name':'local backend rejects anonymous author page and writes','passed':True})
 writer,author=make(height=1140,author=True)
 author.screenshot(path=str(out/'author-desktop-local-test.png'),full_page=True)
 author.locator('#half-minus').click();author.locator('#review-comment').fill('本地测试草稿：不应出现在公开页面。')
 author.locator('#save-cloud-draft').click();author.wait_for_function('document.querySelector("#desk-message").textContent.includes("已确认保存")')
 public=payload(response('/api/reviews'));assert public['reviews'][0]['review']['rating']==5
 assert public['reviews'][0]['review']['comment']=='破旧的修道院比完整的好看多了！'
 writer.close();writer,author=make(height=1140,author=True)
 assert author.locator('#review-comment').input_value()=='本地测试草稿：不应出现在公开页面。'
 author.locator('#publish-review').click();author.wait_for_function('document.querySelector("#desk-message").textContent.includes("已确认发布")')
 public=payload(response('/api/reviews'));assert public['reviews'][0]['review']['rating']==4.5
 assert public['reviews'][0]['review']['comment']=='本地测试草稿：不应出现在公开页面。'
 author.locator('#review-comment').fill('破旧的修道院比完整的好看多了！');author.locator('#half-plus').click();author.locator('#publish-review').click();author.wait_for_function('document.querySelector("#desk-message").textContent.includes("已确认发布")')
 results.append({'name':'local signed-JWT backend: draft persists new context, public isolation, publish visible to independent reader, original restored','passed':True})
 for width,height in [(390,844),(768,1024),(1024,768)]:
  c,q=make(width,height);assert q.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
  q.locator('.memory-row').click();q.locator('#photo-next').click();assert '02 / 02' in q.locator('#photo-counter').inner_text();q.screenshot(path=str(out/f'album-{width}.png'),full_page=True)
  results.append({'name':f'{width}x{height}: no horizontal overflow, portrait photo shown','passed':True});c.close()
 c,m=make(390,844,True);assert m.evaluate('document.documentElement.scrollWidth <= innerWidth+1');m.screenshot(path=str(out/'author-mobile-local-test.png'),full_page=True)
 results.append({'name':'mobile author page no horizontal overflow','passed':True})
 assert not errors,errors
 browser.close()
(out/'browser-results.json').write_text(json.dumps({'environment':__doc__,'results':results,'browserErrors':errors},ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
