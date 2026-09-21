import {json, VERSION, canonicalOrigin} from '../../server/http.mjs';
import {authConfig} from '../../server/auth.mjs';
import {getAuthorRecord} from '../../server/reviews.mjs';
export async function onRequest({request,env}) {
  if(request.method!=='GET')return json({ok:false,message:'只支持 GET'},405);
  let origin=null,access=false,database=false,databaseCode=null;
  try{origin=canonicalOrigin(env);authConfig(env);access=true;}catch{}
  try{await getAuthorRecord(env);database=true;}catch(e){databaseCode=e.code||'DATABASE_UNAVAILABLE';}
  return json({ok:true,version:VERSION,functions:true,streetGateway:true,
    database:{bound:!!env.DB,ready:database,code:databaseCode},
    author:{configured:access,origin},note:'这里只检查部署配置；不代表地图上游或邮箱登录已通过实测。'});
}
