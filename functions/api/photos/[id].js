import {json,errorResponse} from '../../../server/http.mjs';
import {readPhoto} from '../../../server/places.mjs';
export async function onRequest({request,env,params}) {
  if(request.method!=='GET')return json({ok:false},405);
  try{return await readPhoto(env,params.id);}catch(e){return errorResponse(e);}
}
