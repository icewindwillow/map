/** Read the exact versioned assets referenced by public/index.html. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(root, 'public');
const read = async p => {
  const resolved = path.resolve(publicRoot, p);
  if (!resolved.startsWith(publicRoot + path.sep)) throw new Error(`Invalid asset path: ${p}`);
  return readFile(resolved, 'utf8');
};
let html = await read('index.html');
const cssTag = html.match(/<link\s+rel="stylesheet"\s+href="(\.\/assets\/[^"?]+\.css)"\s*>/);
const appTag = html.match(/<script\s+type="module"\s+src="(\.\/assets\/[^"?]+\.js)"><\/script>/);
if (!cssTag || !appTag) throw new Error('Cannot find local stylesheet and app module in index.html.');
const css = await read(cssTag[1]);
let app = await read(appTag[1]);
const helperImport = app.match(/^import\s+\{[^}]+\}\s+from\s+['"](\.\/geo[^'"]*\.js)['"];\s*/);
if (!helperImport) throw new Error('Cannot find local geographic helper import.');
const helperPath = path.posix.join(path.posix.dirname(appTag[1]), helperImport[1]);
const helpers = (await read(helperPath)).replaceAll(/^export /gm, '');
app = app.slice(helperImport[0].length);
const memoryData = JSON.parse(await read('data/memories.json'));
const firstMemory = JSON.parse(await read('data/fountains-abbey.v0.3.json'));
const embeddedAssets={};
for(const memory of [...firstMemory.memories,...memoryData.memories]){
 const photos=Array.isArray(memory.photos)?memory.photos:(memory.photo?[{src:memory.photo}]:[]);
 for(const photo of photos){for(const key of ['src','thumbnail']){
  const src=photo[key];if(!src||embeddedAssets[src])continue;
  const target=path.resolve(publicRoot,src);if(!target.startsWith(publicRoot+path.sep))throw new Error('Image outside project: '+src);
  const content=await readFile(target);const ext=path.extname(target).toLowerCase();
  const mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif'}[ext];
  if(!mime)throw new Error('Unsupported preview image: '+src);
  embeddedAssets[src]=`data:${mime};base64,${content.toString('base64')}`;
 }}
}
const embedded = JSON.stringify({
  geography: JSON.parse(await read('data/uk-overview.geojson')),
  demos: JSON.parse(await read('data/demos.json')),
  memories: memoryData,
  firstMemory,
  assets: embeddedAssets,
}).replaceAll('<', '\\u003c');
const favicon = 'data:image/svg+xml,' + encodeURIComponent(await read('assets/favicon.svg'));
html = html.replace(cssTag[0], () => `<style>\n${css}\n</style>`)
  .replace(appTag[0], () => `<script id="atlas-embedded" type="application/json">${embedded}</script>\n<script type="module">\n${helpers}\n${app}\n</script>`)
  .replace('./assets/favicon.svg', favicon);
const output = process.argv[2] || path.join(root, 'preview.html');
await writeFile(output, html);
console.log(`Preview: ${output}`);
