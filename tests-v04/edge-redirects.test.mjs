import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAccessToken} from '../server/auth.mjs';
import {serveTile} from '../server/tiles.mjs';
import {testAuth, envBase} from './auth-fixtures.mjs';

test('certificate requests use an edge-supported mode and reject redirects', async () => {
  const auth = await testAuth();
  await assert.rejects(verifyAccessToken(await auth.token(), envBase, {
    fetcher: async (url, options) => {
      assert.equal(options.redirect, 'manual');
      return new Response(null, {status: 302, headers: {Location: 'https://example.invalid/'}});
    }
  }), {code: 'AUTH_UNAVAILABLE'});
});

test('tile requests use an edge-supported mode and reject redirects', async () => {
  let requested = false;
  const response = await serveTile({request: new Request('https://iris.icewindwillow.cn/api/tiles/4/8/5.png', {
    headers: {Referer: 'https://iris.icewindwillow.cn/'}
  })}, {cache: null, fetcher: async (url, options) => {
    requested = true;
    assert.equal(options.redirect, 'manual');
    return new Response(null, {status: 302, headers: {Location: 'https://example.invalid/'}});
  }});
  assert.ok(requested);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, 'MAP_UPSTREAM_302');
});
