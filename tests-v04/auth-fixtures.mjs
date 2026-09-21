/** Signed test tokens only. No production authentication bypass exists. */
export const envBase={AUTHOR_ORIGIN:'https://iris.icewindwillow.cn',ACCESS_TEAM_DOMAIN:'https://local-test-team.cloudflareaccess.com',ACCESS_AUD:'unit-test-audience',AUTHOR_EMAILS:'author@example.test'};
let pair;
export async function testAuth(){
  pair ||= await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',hash:'SHA-256',modulusLength:2048,publicExponent:new Uint8Array([1,0,1])},true,['sign','verify']);
  const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-rsa-key',use:'sig',alg:'RS256'};
  const b64=s=>Buffer.from(typeof s==='string'?s:JSON.stringify(s)).toString('base64url');
  return {jwk,fetcher:async()=>new Response(JSON.stringify({keys:[jwk]}),{headers:{'Content-Type':'application/json'}}),async token(claims={},header={}){
    const now=Math.floor(Date.now()/1000);const h=b64({typ:'JWT',alg:'RS256',kid:jwk.kid,...header}),p=b64({iss:envBase.ACCESS_TEAM_DOMAIN,aud:[envBase.ACCESS_AUD],iat:now-5,exp:now+3600,sub:'test-author-id',email:'author@example.test',...claims});
    const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(`${h}.${p}`));return `${h}.${p}.${Buffer.from(signature).toString('base64url')}`;
  }};
}
