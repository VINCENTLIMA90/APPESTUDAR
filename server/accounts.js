import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {translate} from '../src/i18n.js';
const hashPassword=promisify(scrypt),digest=token=>createHash('sha256').update(token).digest('hex');
export function emailConfiguration(env=process.env){return {provider:env.EMAIL_PROVIDER||'',key:env.EMAIL_API_KEY||'',from:env.EMAIL_FROM||'',origin:env.APP_URL||'',production:env.NODE_ENV==='production',development:env.NODE_ENV==='development',maxSessions:Math.max(1,Math.min(20,Math.floor(Number(env.MAX_SESSIONS_PER_USER)||1)))};}
export async function deliverEmail(config,message,requester=fetch){
  const postmark=config.provider==='postmark';
  const response=await requester(postmark?'https://api.postmarkapp.com/email':'https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...(postmark?{'X-Postmark-Server-Token':config.key}:{Authorization:'Bearer '+config.key})},body:JSON.stringify(postmark?{From:config.from,To:message.to,Subject:message.subject,TextBody:message.text}:{from:config.from,to:[message.to],subject:message.subject,text:message.text})});
  if(!response.ok)throw new Error('email_unavailable');
}
export function installAccounts(app,db,{secure,limit,languages,config=emailConfiguration(),send=deliverEmail,logger=console.info,clock=()=>new Date()}){
  for(const [table,name,definition] of [['users','email_verified_at','TEXT'],['sessions','created_at','INTEGER NOT NULL DEFAULT 0'],['sessions','revoked_reason','TEXT'],['sessions','device_id','TEXT']])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  db.exec(`CREATE TABLE IF NOT EXISTS account_tokens(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,purpose TEXT NOT NULL,expires INTEGER NOT NULL,used_at INTEGER);
    CREATE INDEX IF NOT EXISTS account_tokens_user ON account_tokens(user_id,purpose);
    CREATE TABLE IF NOT EXISTS email_deliveries(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,purpose TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,completed_at INTEGER,error_code TEXT);`);
  if(!db.prepare('PRAGMA table_info(account_tokens)').all().some(c=>c.name==='created_at'))db.exec('ALTER TABLE account_tokens ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
  const user=id=>db.prepare('SELECT id,name,email,language,created_at,email_verified_at FROM users WHERE id=?').get(id);
  const configured=['resend','postmark'].includes(config.provider)&&Boolean(config.key&&config.from&&config.origin);
  function origin(){try{const u=new URL(config.origin);if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||!(u.protocol==='https:'||(!config.production&&u.protocol==='http:')))return null;return u.origin;}catch{return config.production?null:'http://localhost:3001';}}
  function status(userId){const row=db.prepare("SELECT status FROM email_deliveries WHERE user_id=? AND purpose='verify_email' ORDER BY created_at DESC,rowid DESC LIMIT 1").get(userId),token=db.prepare("SELECT created_at FROM account_tokens WHERE user_id=? AND purpose='verify_email' AND used_at IS NULL").get(userId);return {verificationFailed:row?.status==='failed',verificationRetryAt:token?new Date(token.created_at+60000).toISOString():null};}
  function initialGoal(userId,goal){if(goal==='ccse')db.prepare('INSERT OR IGNORE INTO study_settings(user_id,goal,updated_at) VALUES (?,?,?)').run(userId,'ccse',clock().toISOString());}
  function issue(account,purpose){
    const now=clock().getTime();
    if(db.prepare('SELECT 1 FROM account_tokens WHERE user_id=? AND purpose=? AND used_at IS NULL AND created_at>?').get(account.id,purpose,now-60000))return;
    const token=randomBytes(32).toString('hex'),deliveryId=randomBytes(16).toString('hex');
    db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').run(account.id,purpose);
    db.prepare('INSERT INTO account_tokens(hash,user_id,purpose,expires,used_at,created_at) VALUES (?,?,?,?,NULL,?)').run(digest(token),account.id,purpose,now+3600000,now);
    db.prepare('INSERT INTO email_deliveries VALUES (?,?,?,?,?,NULL,NULL)').run(deliveryId,account.id,purpose,'pending',now);
    const complete=(value,error=null)=>db.prepare('UPDATE email_deliveries SET status=?,completed_at=?,error_code=? WHERE id=?').run(value,clock().getTime(),error,deliveryId);
    const base=origin();if(!base){complete('failed','configuration');return;}
    const action=purpose==='reset_password'?'reset':'verify',link=base+'/?account='+action+'&token='+token;
    const message={to:account.email,subject:translate(account.language,action==='reset'?'emailResetSubject':'emailVerifySubject'),text:translate(account.language,'emailActionBody',{name:account.name,link})};
    if(configured)Promise.resolve().then(()=>send(config,message)).then(()=>complete('sent')).catch(()=>{complete('failed','delivery_failed');logger('Transactional email delivery failed.');});
    else if(config.development&&!config.production){logger('Development account link: '+link);complete('development');}else complete('failed','configuration');
  }
  function session(res,id){
    const now=clock().getTime(),token=randomBytes(32).toString('hex');
    db.exec('BEGIN IMMEDIATE');
    try{
      db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
      const active=db.prepare('SELECT token FROM sessions WHERE user_id=? AND revoked_reason IS NULL ORDER BY created_at DESC,rowid DESC').all(id);
      for(const row of active.slice(config.maxSessions-1))db.prepare("UPDATE sessions SET revoked_reason='session_replaced' WHERE token=?").run(row.token);
      db.prepare('INSERT INTO sessions(token,user_id,expires,created_at) VALUES (?,?,?,?)').run(digest(token),id,now+30*86400000,now);db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    res.cookie('rumbo_session',token,{httpOnly:true,sameSite:'lax',secure,maxAge:30*86400000,path:'/'});
  }
  app.use((req,res,next)=>{
    const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('rumbo_session='))?.slice(14);
    if(token&&/^[a-f0-9]{64}$/.test(token)){
      const row=db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(digest(token),clock().getTime());
      if(row?.revoked_reason)req.sessionIssue=row.revoked_reason==='session_replaced'?'session_replaced':'login_required';
      else if(row)req.user=user(row.user_id);
    }next();
  });
  app.get('/api/me',(req,res)=>res.json({user:req.user||null,...(req.user?{email:status(req.user.id)}:{}),...(req.sessionIssue?{error:req.sessionIssue}:{})}));
  app.post('/api/auth/register',limit,async(req,res)=>{
    const {name,email,password,language}=req.body;
    if(typeof name!=='string'||!name.trim()||name.length>70||typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<10||password.length>128)return res.status(400).json({error:'registration_invalid'});
    const normalized=email.trim().toLowerCase();
    if(db.prepare('SELECT 1 FROM users WHERE email=?').get(normalized))return res.status(409).json({error:'email_exists'});
    const id=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex'),passwordHash=(await hashPassword(password,salt,64)).toString('hex');
    try{db.prepare('INSERT INTO users(id,name,email,password,salt,language,created_at) VALUES (?,?,?,?,?,?,?)').run(id,name.trim(),normalized,passwordHash,salt,languages.includes(language)?language:'pt-PT',clock().toISOString());}catch(error){if(error.code?.includes('CONSTRAINT')||error.errcode===2067)return res.status(409).json({error:'email_exists'});throw error;}
    initialGoal(id,req.body.initialGoal);session(res,id);issue(user(id),'verify_email');res.status(201).json({user:user(id)});
  });
  app.post('/api/auth/login',limit,async(req,res)=>{
    const {email,password}=req.body;
    if(typeof email!=='string'||typeof password!=='string'||password.length>128)return res.status(400).json({error:'credentials_invalid'});
    const account=db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase()),candidate=await hashPassword(password,account?.salt||'dummy-salt-for-timing',64);
    if(!account||!timingSafeEqual(candidate,Buffer.from(account.password,'hex')))return res.status(401).json({error:'credentials_invalid'});
    session(res,account.id);res.json({user:user(account.id)});
  });
  app.post('/api/auth/logout',(req,res)=>{const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('rumbo_session='))?.slice(14);if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));res.clearCookie('rumbo_session',{path:'/',httpOnly:true,sameSite:'lax',secure});res.json({ok:true});});
  app.post('/api/auth/forgot-password',limit,(req,res)=>{
    const email=typeof req.body.email==='string'?req.body.email.trim().toLowerCase():'';
    const account=db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if(account)issue(account,'reset_password');
    res.status(202).json({ok:true,message:'email_request_received'});
  });
  app.post('/api/auth/request-verification',limit,(req,res)=>{if(req.user&&!req.user.email_verified_at)issue(req.user,'verify_email');res.status(202).json({ok:true,message:'email_request_received'});});
  async function consume(req,res,purpose){
    const {token,password}=req.body;
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return res.status(400).json({error:'account_token_invalid'});
    if(purpose==='reset_password'&&(typeof password!=='string'||password.length<10||password.length>128))return res.status(400).json({error:'registration_invalid'});
    const salt=purpose==='reset_password'?randomBytes(16).toString('hex'):null;
    const passwordHash=salt?(await hashPassword(password,salt,64)).toString('hex'):null;
    db.exec('BEGIN IMMEDIATE');
    try{
      const row=db.prepare('SELECT * FROM account_tokens WHERE hash=? AND purpose=? AND used_at IS NULL AND expires>?').get(digest(token),purpose,clock().getTime());
      if(!row){db.exec('ROLLBACK');return res.status(400).json({error:'account_token_invalid'});}
      db.prepare('UPDATE account_tokens SET used_at=? WHERE hash=?').run(clock().getTime(),row.hash);
      if(purpose==='reset_password'){
        db.prepare('UPDATE users SET password=?,salt=? WHERE id=?').run(passwordHash,salt,row.user_id);
        db.prepare("UPDATE sessions SET revoked_reason='password_reset' WHERE user_id=?").run(row.user_id);
      }else db.prepare('UPDATE users SET email_verified_at=? WHERE id=?').run(clock().toISOString(),row.user_id);
      db.exec('COMMIT');res.json({ok:true});
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  app.post('/api/auth/reset-password',limit,(req,res,next)=>consume(req,res,'reset_password').catch(next));
  app.post('/api/auth/verify-email',limit,(req,res,next)=>consume(req,res,'verify_email').catch(next));
  return {emailAvailable:configured&&Boolean(origin()),status,user,session,initialGoal};
}
