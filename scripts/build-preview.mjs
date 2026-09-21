/** Generates a self-contained HTML preview; deployment continues to use public/. */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFile(path.join(root,'public',p),'utf8');
let html=await read('index.html');
const css=await read('assets/style.css');
const helpers=(await read('assets/geo.js')).replaceAll(/^export /gm,'');
const app=(await read('assets/app.js')).replace(/^import .*?;\s*/,'');
const embedded=JSON.stringify({geography:JSON.parse(await read('data/uk-overview.geojson')),demos:JSON.parse(await read('data/demos.json')),memories:JSON.parse(await read('data/memories.json'))}).replaceAll('<','\\u003c');
const favicon='data:image/svg+xml,'+encodeURIComponent(await read('assets/favicon.svg'));
html=html.replace('<link rel="stylesheet" href="./assets/style.css">',()=>`<style>\n${css}\n</style>`)
 .replace('<script type="module" src="./assets/app.js"></script>',()=>`<script id="atlas-embedded" type="application/json">${embedded}</script>\n<script type="module">\n${helpers}\n${app}\n</script>`)
 .replace('./assets/favicon.svg',favicon);
const out=process.argv[2]||path.join(root,'preview.html');await writeFile(out,html);console.log(`Preview: ${out}`);
