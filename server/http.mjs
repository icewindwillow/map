/** Shared server-only responses. Never copy bindings or Access tokens into JSON. */
export const VERSION = '0.6.0';
export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Robots-Tag': 'noindex, nofollow',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
};
export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store', ...extra
  }});
}
export function errorResponse(error) {
  if (error instanceof HttpError) return json({ ok: false, code: error.code, message: error.message }, error.status);
  // Details stay in server logs, never in a public response.
  console.error('[iris-api]', error?.message || 'Unknown server error');
  return json({ ok: false, code: 'SERVER_ERROR', message: '服务暂时无法完成请求。未确认保存，请保留编辑内容后重试。' }, 500);
}
export async function limitedJson(request, limit = 48 * 1024) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || ''))
    throw new HttpError(415, 'JSON_REQUIRED', '请使用 JSON 请求。');
  if (Number(request.headers.get('Content-Length') || 0) > limit)
    throw new HttpError(413, 'TOO_LARGE', '提交内容过大。');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'EMPTY_BODY', '提交内容为空。');
  const chunks = []; let size = 0;
  try {
    for (;;) { const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength; if (size > limit) { await reader.cancel(); throw new HttpError(413, 'TOO_LARGE', '提交内容过大。'); } chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { throw new HttpError(400, 'BAD_JSON', '提交内容不是有效的 JSON。'); }
}
export function canonicalOrigin(env) {
  let u; try { u = new URL(env.AUTHOR_ORIGIN || ''); } catch { throw new HttpError(503, 'AUTHOR_CONFIG_REQUIRED', '尚未配置作者后台地址。'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash)
    throw new HttpError(503, 'AUTHOR_CONFIG_REQUIRED', '作者后台地址必须是一个 HTTPS 来源地址。');
  return u.origin;
}
