import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../public/", import.meta.url));
const read = (name) => readFile(path.join(root, name), "utf8");
test("homepage has a title, Chinese locale and viewport", async () => {
  const html = await read("index.html");
  assert.match(html, /lang="zh-CN"/); assert.match(html, /name="viewport"/); assert.match(html, /<title>英国 · 记忆地图<\/title>/);
});
test("local homepage assets exist", async () => {
  const html = await read("index.html");
  for (const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^"#]+)"/g)) assert.ok((await stat(path.join(root, match[1]))).isFile());
});
test("starter ships without personal memories", async () => {
  const data = JSON.parse(await read("data/memories.json"));
  assert.equal(data.schemaVersion, 1); assert.deepEqual(data.memories, []);
});
test("no duplicate element ids", async () => {
  const html = await read("index.html");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
});
test("privacy-related headers and 404 exist", async () => {
  const headers = await read("_headers");
  assert.match(headers, /X-Robots-Tag: noindex/); assert.match(headers, /Content-Security-Policy:/);
  assert.match(await read("404.html"), /404/);
});
test("no external script or style dependency", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
  assert.doesNotMatch(await read("assets/app.js"), /innerHTML/);
});
