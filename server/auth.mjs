/** Cloudflare Access JWT verification using Web Crypto, restricted to RS256.
 * Fixed issuer from trusted configuration; never follow a JWT's jku/x5u.
 * There is deliberately no local-auth bypass, default password or unsigned-token mode.
 */
import {HttpError, canonicalOrigin} from './http.mjs';
const keySets = new Map();
const enc = new TextEncoder();
const denied = () => new HttpError(401, 'LOGIN_REQUIRED', '请从作者入口重新登录。当前编辑内容尚未保存。');
function b64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw denied();
  try { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0)); }
  catch { throw denied(); }
}
function jsonPart(part) { try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(b64url(part))); } catch { throw denied(); } }
export function authConfig(env) {
  const issuer = String(env.ACCESS_TEAM_DOMAIN || '').replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$/.test(issuer) ||
      typeof env.ACCESS_AUD !== 'string' || !env.ACCESS_AUD.trim())
    throw new HttpError(503, 'ACCESS_CONFIG_REQUIRED', '尚未配置 Cloudflare Access 的团队域名和应用 AUD。');
  const emails = String(env.AUTHOR_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!emails.length || emails.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))
    throw new HttpError(503, 'ACCESS_CONFIG_REQUIRED', '尚未配置有效的作者邮箱白名单。');
  return {issuer, audience: env.ACCESS_AUD.trim(), emails, origin: canonicalOrigin(env)};
}
async function keysFor(issuer, kid, fetcher) {
  const now = Date.now(); let entry = keySets.get(issuer);
  const refresh = !entry || now > entry.expires || (!entry.keys.some(k => k.kid === kid) && now - entry.fetched > 60000);
  if (refresh) {
    let response;
    // Access certificate endpoints can be slow to respond on a cold or distant edge.
    // Keep this bounded, but do not reject an otherwise valid author session too eagerly.
    // Workers supports manual redirects; the !response.ok check below rejects 3xx.
    try { response = await fetcher(`${issuer}/cdn-cgi/access/certs`, {signal: AbortSignal.timeout(20000), redirect: 'manual'}); }
    catch { throw new HttpError(503, 'AUTH_UNAVAILABLE', '暂时无法验证登录，请稍后重试。'); }
    if (!response.ok) throw new HttpError(503, 'AUTH_UNAVAILABLE', '暂时无法读取登录验证公钥。');
    const body = await response.json();
    if (!Array.isArray(body.keys) || body.keys.length > 20) throw new HttpError(503, 'AUTH_UNAVAILABLE', '登录验证公钥格式错误。');
    entry = {keys: body.keys, expires: now + 3600000, fetched: now}; keySets.set(issuer, entry);
    if (keySets.size > 8) keySets.delete(keySets.keys().next().value);
  }
  return entry.keys.find(k => k.kid === kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
}
export async function verifyAccessToken(token, env, {fetcher = fetch, now = Math.floor(Date.now()/1000)} = {}) {
  const config = authConfig(env);
  if (typeof token !== 'string' || token.length > 16000) throw denied();
  const parts = token.split('.'); if (parts.length !== 3) throw denied();
  const header = jsonPart(parts[0]), payload = jsonPart(parts[1]);
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.crit || header.jku || header.x5u || header.b64 === false) throw denied();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw denied();
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== config.issuer || !audiences.includes(config.audience) ||
      !Number.isFinite(payload.exp) || payload.exp <= now ||
      !Number.isFinite(payload.iat) || payload.iat > now + 30 || payload.iat >= payload.exp ||
      (payload.nbf != null && (!Number.isFinite(payload.nbf) || payload.nbf > now + 30)) ||
      typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string') throw denied();
  const jwk = await keysFor(config.issuer, header.kid, fetcher); if (!jwk) throw denied();
  let valid = false;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
    if (key.algorithm.modulusLength < 2048) throw denied();
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  } catch { throw denied(); }
  if (!valid) throw denied();
  const email = payload.email.trim().toLowerCase();
  if (!config.emails.includes(email)) throw new HttpError(403, 'NOT_AN_AUTHOR', '这个邮箱不在作者白名单中。');
  return {email, sub: payload.sub, expiresAt: payload.exp};
}
export async function requireAuthor(request, env, dependencies) {
  const origin = canonicalOrigin(env);
  if (new URL(request.url).origin !== origin) throw new HttpError(403, 'AUTHOR_ORIGIN_ONLY', '写入只允许从指定作者域名进行。');
  return verifyAccessToken(request.headers.get('Cf-Access-Jwt-Assertion'), env, dependencies);
}
export async function csrfFor(token) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`iris-csrf-v1:${token}`)));
  return Array.from(hash, n => n.toString(16).padStart(2, '0')).join('');
}
export async function requireWrite(request, env) {
  if (request.headers.get('Origin') !== canonicalOrigin(env) ||
      (request.headers.get('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin'))
    throw new HttpError(403, 'ORIGIN_REJECTED', '拒绝跨站提交。请在作者后台中发布。');
  const actual = request.headers.get('X-Atlas-CSRF') || '';
  const expected = await csrfFor(request.headers.get('Cf-Access-Jwt-Assertion') || '');
  let mismatch = actual.length ^ expected.length;
  for (let i=0; i<expected.length; i++) mismatch |= expected.charCodeAt(i) ^ (actual.charCodeAt(i) || 0);
  if (mismatch) throw new HttpError(403, 'CSRF_REJECTED', '登录状态已变化，请重新登录后提交。');
}
