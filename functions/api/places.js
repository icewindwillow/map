import {json,errorResponse} from '../../server/http.mjs';
import {listPlaces} from '../../server/places.mjs';
export async function onRequest({request,env}) {
  if(request.method!=='GET')return json({ok:false},405);
  try{return json({ok:true,schemaVersion:1,memories:await listPlaces(env)});}catch(e){return errorResponse(e);}
}
