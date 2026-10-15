import {randomBytes,createHash,createPublicKey,verify,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
const hash=value=>createHash('sha256').update(value).digest('hex'),derive=promisify(scrypt);
export function googleConfiguration(env=process.env){return {clientId:env.GOOGLE_CLIENT_ID||'',clientSecret:env.GOOGLE_CLIENT_SECRET||'',origin:env.APP_URL||'',production:env.NODE_ENV==='production'};}
export async function validateGoogleToken(token,{clientId,nonceHash,keys,now=Date.now()}){
 if(typeof token!=='string'||token.length>20000)throw new Error('google_auth_failed');
 const parts=token.split('.');if(parts.length!==3||parts.some(p=>!/^[\w-]+$/.test(p)))throw new Error('google_auth_failed');
 const header=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error('google_auth_failed');
 const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
 if(!jwk||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw new Error('google_auth_failed');
 const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
 if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||!audiences.includes(clientId)||(audiences.length>1&&claims.azp!==clientId)||(claims.azp&&claims.azp!==clientId)||!Number.isFinite(claims.exp)||claims.exp<=now/1000||!Number.isFinite(claims.iat)||claims.iat>now/1000+60||typeof claims.nonce!=='string'||hash(claims.nonce)!==nonceHash||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||claims.email_verified!==true||typeof claims.email!=='string'||claims.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email))throw new Error('google_auth_failed');
 return claims;
}
export function installGoogle(app,db,{accounts,limit,languages,secure,config=googleConfiguration(),requester=fetch,clock=()=>new Date()}){
 db.exec(`CREATE TABLE IF NOT EXISTS google_accounts(subject TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,linked_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS google_flows(state_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,nonce_hash TEXT NOT NULL,verifier TEXT NOT NULL,language TEXT NOT NULL,goal TEXT,expires INTEGER NOT NULL);`);
 let origin='';try{const u=new URL(config.origin);if(!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&(u.protocol==='https:'||(!config.production&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))origin=u.origin;}catch{}
 const enabled=Boolean(config.clientId&&config.clientSecret&&origin),redirectUri=origin+'/api/auth/google/callback';let cache=null;
 const cookieOptions={httpOnly:true,sameSite:'lax',secure,path:'/api/auth/google',maxAge:600000};
 app.get('/api/auth/options',(_req,res)=>res.json({google:enabled}));
 app.get('/api/auth/google',limit,(req,res)=>{
  if(!enabled)return res.status(503).json({error:'google_unavailable'});
  const state=randomBytes(32).toString('base64url'),browser=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM google_flows WHERE expires<?').run(clock().getTime());
  db.prepare('INSERT INTO google_flows VALUES (?,?,?,?,?,?,?)').run(hash(state),hash(browser),hash(nonce),verifier,languages.includes(req.query.language)?req.query.language:'pt-PT',req.query.goal==='ccse'?'ccse':null,clock().getTime()+600000);
  res.cookie('rumbo_oauth',browser,cookieOptions);
  const params=new URLSearchParams({client_id:config.clientId,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?'+params);
 });
 app.get('/api/auth/google/callback',limit,async(req,res)=>{
  res.clearCookie('rumbo_oauth',cookieOptions);
  const fail=()=>res.redirect((origin||'')+'/?authError=google_auth_failed');
  if(!enabled)return fail();
  const {state,code}=req.query,browser=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('rumbo_oauth='))?.slice(12);
  if(typeof state!=='string'||state.length>200||typeof code!=='string'||code.length>4096||!browser)return fail();
  const flow=db.prepare('DELETE FROM google_flows WHERE state_hash=? RETURNING *').get(hash(state));
  if(!flow||flow.expires<=clock().getTime()||flow.browser_hash!==hash(browser))return fail();
  try{
   const response=await requester('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code',code,code_verifier:flow.verifier}).toString()});
   if(!response.ok)throw new Error('google_auth_failed');const tokens=await response.json();
   const header=JSON.parse(Buffer.from((tokens.id_token||'').split('.')[0]||'','base64url'));
   if(!cache||cache.expires<=clock().getTime()||!cache.keys.some(k=>k.kid===header.kid)){
    const response=await requester('https://www.googleapis.com/oauth2/v3/certs',{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('google_auth_failed');const body=await response.json();if(!Array.isArray(body.keys))throw new Error('google_auth_failed');cache={keys:body.keys,expires:clock().getTime()+300000};
   }
   const claims=await validateGoogleToken(tokens.id_token,{clientId:config.clientId,nonceHash:flow.nonce_hash,keys:cache.keys,now:clock().getTime()}),email=claims.email.toLowerCase().trim();
   const salt=randomBytes(16).toString('hex'),password=(await derive(randomBytes(48).toString('hex'),salt,64)).toString('hex');let id;
   db.exec('BEGIN IMMEDIATE');try{
    const linked=db.prepare('SELECT user_id FROM google_accounts WHERE subject=?').get(claims.sub),existing=db.prepare('SELECT id FROM users WHERE email=?').get(email);
    id=linked?.user_id||existing?.id||randomBytes(16).toString('hex');
    if(!linked&&!existing)db.prepare('INSERT INTO users(id,name,email,password,salt,language,created_at,email_verified_at) VALUES (?,?,?,?,?,?,?,?)').run(id,typeof claims.name==='string'?claims.name.trim().slice(0,70)||email.split('@')[0]:email.split('@')[0],email,password,salt,flow.language,clock().toISOString(),clock().toISOString());
    db.prepare('INSERT OR IGNORE INTO google_accounts VALUES (?,?,?)').run(claims.sub,id,clock().toISOString());
    db.prepare('UPDATE users SET email_verified_at=? WHERE id=? AND email=?').run(clock().toISOString(),id,email);
    accounts.initialGoal(id,flow.goal);db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   accounts.session(res,id);res.redirect(origin+'/');
  }catch{return fail();}
 });
}
