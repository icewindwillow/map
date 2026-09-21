import {json,errorResponse,HttpError,limitedJson} from '../../server/http.mjs';
import {visitorList,addVisitor} from '../../server/visitors.mjs';
export async function onRequest({request,env}) {
  try {
    const url=new URL(request.url);
    if(request.method==='GET')return json({ok:true,...await visitorList(env,url.searchParams.get('place'),url.searchParams.get('before')||'')});
    if(request.method==='POST')return json({ok:true,...await addVisitor(env,request,await limitedJson(request,12*1024))},201);
    throw new HttpError(405,'METHOD_NOT_ALLOWED','不支持此操作。');
  }catch(e){return errorResponse(e);}
}
