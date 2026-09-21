import {json, VERSION} from '../../server/http.mjs';
import {STREET_CONFIG} from '../../server/tiles.mjs';
export function onRequest({request}) {
  return request.method==='GET'?json({ok:true,version:VERSION,...STREET_CONFIG}):json({ok:false,message:'只支持 GET'},405);
}
