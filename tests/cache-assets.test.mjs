import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
const root = new URL('../public/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
test('homepage references new resource URLs rather than the old cached URLs', async () => {
  assert.match(html, /\.\/assets\/style\.v0\.3\.css/);
  assert.match(html, /\.\/assets\/app\.v0\.3\.js/);
  assert.doesNotMatch(html, /(?:href|src)="\.\/assets\/(?:style\.css|app\.js)"/);
});
test('the actual deployed app imports the matching versioned helper', async () => {
  const app = await readFile(new URL('assets/app.v0.3.js', root), 'utf8');
  assert.match(app, /from '\.\/geo\.v0\.3\.js'/);
  assert.doesNotMatch(app, /from '\.\/geo\.js'/);
  assert.ok((await stat(new URL('assets/geo.v0.3.js', root))).isFile());
  assert.doesNotMatch(app, /\.innerHTML\s*=/);
});
