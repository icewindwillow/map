import {json, errorResponse, VERSION} from '../../server/http.mjs';
import {getPublicReviews} from '../../server/reviews.mjs';
export async function onRequest({request,env}) {
  if(request.method!=='GET')return json({ok:false,message:'公开接口只允许读取。'},405);
  try{return json({ok:true,version:VERSION,reviews:await getPublicReviews(env)});}catch(error){return errorResponse(error);}
}
