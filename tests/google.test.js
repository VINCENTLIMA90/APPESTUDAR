import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app.js';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...publicKey.export({format:'jwk'}),kid:'fixture-signing-key',alg:'RS256',use:'sig'};
const config={clientId:'fixture-google-client',clientSecret:'fixture-google-secret',origin:'https://study.example.test',production:true};
const jwt=claims=>{const data=[{alg:'RS256',kid:jwk.kid},claims].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');};
async function fixture(t,enabled=true){
 const dir=mkdtempSync(path.join(tmpdir(),'rumbo-google-'));let claims={},nonce='',badSignature=false,exchanges=0,lastVerifier='',lastChallenge='';const emails=[];
 const runtime=createApp({dataDir:dir,secure:false,emailConfig:{provider:'resend',key:'fixture-email',from:'study@example.test',origin:config.origin,production:true,maxSessions:1},emailSend:async(_c,m)=>emails.push(m),googleConfig:enabled?config:{...config,clientSecret:''},googleFetch:async(url,options)=>{
  if(url==='https://www.googleapis.com/oauth2/v3/certs')return new Response(JSON.stringify({keys:[jwk]}));
  assert.equal(url,'https://oauth2.googleapis.com/token');exchanges++;const body=new URLSearchParams(options.body);assert.equal(body.get('client_secret'),config.clientSecret);assert.equal(body.get('redirect_uri'),config.origin+'/api/auth/google/callback');lastVerifier=body.get('code_verifier');assert.equal(createHash('sha256').update(lastVerifier).digest('base64url'),lastChallenge);
  const now=Math.floor(Date.now()/1000),token=jwt({iss:'https://accounts.google.com',aud:config.clientId,sub:'fixture-google-user',email:'ana@example.test',email_verified:true,name:'Ana Google',nonce,iat:now,exp:now+3600,...claims});return new Response(JSON.stringify({id_token:badSignature?token.slice(0,-20)+'invalid-signature-xyz':token}));
 }});
 const server=await new Promise(resolve=>{const s=runtime.app.listen(0,'127.0.0.1',()=>resolve(s));}),base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));runtime.db.close();rmSync(dir,{recursive:true,force:true});});
 async function req(route,body,cookie){const response=await fetch(base+'/api'+route,{redirect:'manual',method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:response.headers.get('content-type')?.includes('json')?await response.json():null,location:response.headers.get('location'),cookies:response.headers.getSetCookie()};}
 async function begin(){const response=await req('/auth/google?language=fr&goal=ccse'),url=new URL(response.location);assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('scope'),'openid email profile');nonce=url.searchParams.get('nonce');lastChallenge=url.searchParams.get('code_challenge');return{state:url.searchParams.get('state'),cookie:response.cookies[0].split(';')[0]};}
 const complete=flow=>req('/auth/google/callback?'+new URLSearchParams({state:flow.state,code:'fixture-one-use-code'}),undefined,flow.cookie);
 return{runtime,req,begin,complete,emails,setClaims:value=>{claims=value;},bad:()=>{badSignature=true;},exchanges:()=>exchanges};
}
test('Google button availability requires server configuration',async t=>{const f=await fixture(t,false);assert.equal((await f.req('/auth/options')).data.google,false);assert.equal((await f.req('/auth/google')).status,503);assert.equal(f.exchanges(),0);});
test('Google authorization code with PKCE links an existing account, verifies its email and enforces the session limit',async t=>{
 const f=await fixture(t),registered=await f.req('/auth/register',{name:'Ana',email:'ana@example.test',password:'test-password-123',language:'pt-PT'}),oldCookie=registered.cookies[0].split(';')[0],flow=await f.begin();
 assert.equal((await f.req('/auth/options')).data.google,true);const response=await f.complete(flow);assert.equal(response.status,302);assert.equal(response.location,config.origin+'/');
 const cookie=response.cookies.find(c=>c.startsWith('rumbo_session=')).split(';')[0],me=await f.req('/me',undefined,cookie);assert.equal(me.data.user.id,registered.data.user.id);assert.ok(me.data.user.email_verified_at);assert.equal(f.runtime.db.prepare('SELECT COUNT(*) n FROM users').get().n,1);assert.equal(f.runtime.db.prepare('SELECT user_id FROM google_accounts').get().user_id,registered.data.user.id);
 assert.equal((await f.req('/me',undefined,oldCookie)).data.error,'session_replaced');assert.equal((await f.complete(flow)).location,config.origin+'/?authError=google_auth_failed');assert.equal(f.exchanges(),1);
});
test('a new Google account has a verified email, initial goal and can later set a password with recovery',async t=>{
 const f=await fixture(t),response=await f.complete(await f.begin()),cookie=response.cookies.find(c=>c.startsWith('rumbo_session=')).split(';')[0],me=(await f.req('/me',undefined,cookie)).data;
 assert.equal(me.user.language,'fr');assert.ok(me.user.email_verified_at);assert.equal(f.runtime.db.prepare('SELECT goal FROM study_settings').get().goal,'ccse');
 await f.req('/auth/forgot-password',{email:'ana@example.test'});const token=new URL(f.emails.at(-1).text.match(/https:\/\/\S+/)[0]).searchParams.get('token');assert.equal((await f.req('/auth/reset-password',{token,password:'a-new-password-123'})).status,200);assert.equal((await f.req('/auth/login',{email:'ana@example.test',password:'a-new-password-123'})).status,200);
});
for(const [name,claims]of [['unverified email',{email_verified:false}],['wrong audience',{aud:'different-client'}],['wrong nonce',{nonce:'other-nonce'}],['expired token',{exp:1}],['wrong issuer',{iss:'https://attacker.example'}]])test('Google rejects '+name,async t=>{const f=await fixture(t);f.setClaims(claims);const response=await f.complete(await f.begin());assert.equal(response.location,config.origin+'/?authError=google_auth_failed');assert.equal(f.runtime.db.prepare('SELECT COUNT(*) n FROM users').get().n,0);assert.ok(!response.cookies.some(c=>c.startsWith('rumbo_session=')));});
test('Google rejects an invalid signature and an OAuth flow from a different browser before accepting any account',async t=>{
 const f=await fixture(t);f.bad();assert.equal((await f.complete(await f.begin())).location,config.origin+'/?authError=google_auth_failed');const flow=await f.begin();assert.equal((await f.complete({...flow,cookie:'rumbo_oauth=other-browser'})).location,config.origin+'/?authError=google_auth_failed');assert.equal(f.exchanges(),1);assert.equal(f.runtime.db.prepare('SELECT COUNT(*) n FROM users').get().n,0);
});

test('Google rejects unknown state and missing browser binding without exchanging any authorization code',async t=>{
 const f=await fixture(t),flow=await f.begin();
 assert.equal((await f.complete({...flow,state:'an-unknown-state'})).location,config.origin+'/?authError=google_auth_failed');
 assert.equal((await f.complete({...flow,cookie:''})).location,config.origin+'/?authError=google_auth_failed');assert.equal(f.exchanges(),0);assert.equal(f.runtime.db.prepare('SELECT COUNT(*) n FROM users').get().n,0);
});
