import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app.js';
import {grantPlan,testAIConfig} from './helpers.js';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {deliverEmail,emailConfiguration} from '../server/accounts.js';
async function fixture(t,options={}){
 const directory=mkdtempSync(path.join(tmpdir(),'rumbo-commercial-')),mail=[],logs=[];
 let fail=false,calls=0;
 const runtime=createApp({dataDir:directory,secure:false,aiConfig:testAIConfig,emailConfig:{provider:'resend',key:'fixture-email-key',from:'study@example.test',origin:'https://study.example.test',production:true,maxSessions:1},emailSend:async(_config,message)=>{mail.push(message);},logger:message=>logs.push(message),ai:async args=>{calls++;assert.equal(args.key,testAIConfig.key);assert.equal(args.model,'fixture-model');if(fail)throw new Error('ai_upstream');return{summary:'Claro.',strengths:[],improvements:[],corrected:'Hola.',nextStep:'Practica.'};},tutor:async args=>{calls++;assert.equal(args.key,testAIConfig.key);assert.equal(args.model,'fixture-model');if(fail)throw new Error('ai_upstream');return{reply:'Hola.',correction:'',question:'¿Qué tal?',focus:'Práctica'};},...options});
 const server=await new Promise(resolve=>{const s=runtime.app.listen(0,'127.0.0.1',()=>resolve(s));}),base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));runtime.db.close();rmSync(directory,{recursive:true,force:true});});
 async function req(route,body,cookie,method){const r=await fetch(base+'/api'+route,{method:method||(body===undefined?'GET':'POST'),headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function account(name='learner'){const result=await req('/auth/register',{name,email:name+'@example.test',password:'test-password-123',language:'pt-PT'});assert.equal(result.status,201);return {id:result.data.user.id,cookie:result.cookie,email:name+'@example.test'};}
 const token=()=>new URL(mail.at(-1).text.match(/https:\/\/\S+/)[0]).searchParams.get('token');
 return {runtime,req,account,mail,logs,token,fail:value=>{fail=value;},calls:()=>calls};
}
test('free account: four lessons, full assessment, exactly one simulation per module, no paid tools or AI',async t=>{
 const f=await fixture(t),a=await f.account();
 assert.equal((await f.req('/lessons/c1')).status,401);
 for(const id of ['c1','c2','d1','d2'])assert.equal((await f.req('/lessons/'+id,undefined,a.cookie)).status,200);
 for(const id of ['c3','d3'])assert.equal((await f.req('/lessons/'+id,undefined,a.cookie)).status,402);
 const assessment=await f.req('/quizzes',{module:'ccse',mode:'assessment'},a.cookie);assert.equal(assessment.status,201);assert.equal(assessment.data.questions.length,12);
 for(const kind of ['writing','speaking'])assert.equal((await f.req('/submissions',{kind,text:'Me llamo Alex.',purpose:'assessment'},a.cookie)).status,201);
 assert.equal((await f.req('/submissions',{kind:'writing',text:'Hola.'},a.cookie)).status,402);
 assert.equal((await f.req('/quizzes',{module:'ccse',mode:'simulation'},a.cookie)).data.error,'trial_email_required');
 await f.req('/auth/verify-email',{token:f.token()});
 for(const [module,count,minutes] of [['ccse',25,45],['dele',16,35]]){
  const trials=await Promise.all([f.req('/quizzes',{module,mode:'simulation'},a.cookie),f.req('/quizzes',{module,mode:'simulation'},a.cookie)]);assert.deepEqual(trials.map(r=>r.status).sort(),[201,402]);const quiz=trials.find(r=>r.status===201).data;assert.equal(quiz.questions.length,count);assert.equal(quiz.minutes,minutes);
  assert.equal((await f.req('/quizzes/'+quiz.id+'/submit',{answers:Array(count).fill(0)},a.cookie)).status,200);
  assert.equal((await f.req('/quizzes',{module,mode:'simulation'},a.cookie)).status,402);
  assert.equal((await f.req('/quizzes',{module,mode:'practice'},a.cookie)).status,402);
 }
 for(const route of ['/plan','/review','/exams','/tutor'])assert.equal((await f.req(route,undefined,a.cookie)).status,402);
 assert.equal((await f.req('/tutor/chat',{message:'Hola',consent:true,key:'client-fake-key',provider:'openai'},a.cookie)).status,402);assert.equal(f.calls(),0);
});
test('each plan gates practice, review, full DELE, study plan and tutor by module',async t=>{
 const f=await fixture(t);
 for(const plan of ['ccse','dele','both']){
  const a=await f.account(plan);grantPlan(f.runtime.db,a.id,plan);
  for(const module of ['ccse','dele']){
   const expected=plan==='both'||plan===module;
   assert.equal((await f.req('/quizzes',{module,mode:'practice'},a.cookie)).status,expected?201:402);
   assert.equal((await f.req('/review?module='+module,undefined,a.cookie)).status,expected?200:402);
   assert.equal((await f.req('/tutor?module='+module,undefined,a.cookie)).status,expected?200:402);
  }
  assert.equal((await f.req('/exams',undefined,a.cookie)).status,plan==='ccse'?402:200);
  const settings=(await f.req('/plan',undefined,a.cookie)).data.settings;assert.equal(settings.goal,plan);
  assert.equal((await f.req('/plan',{goal:'both',sessions_week:3,session_minutes:30},a.cookie,'PUT')).status,plan==='both'?200:402);
 }
});
test('server AI quotas count success, refund failures, reject missing consent and reset with billing period',async t=>{
 const config={...testAIConfig,limits:{ccse:{corrections:0,tutor:1},dele:{corrections:1,tutor:1},both:{corrections:1,tutor:1}}};
 const f=await fixture(t,{aiConfig:config}),a=await f.account();grantPlan(f.runtime.db,a.id,'both');
 const submission=(await f.req('/submissions',{kind:'writing',text:'Hola.'},a.cookie)).data;
 assert.equal((await f.req('/submissions/'+submission.id+'/evaluate',{},a.cookie)).status,400);
 f.fail(true);assert.equal((await f.req('/submissions/'+submission.id+'/evaluate',{consent:true},a.cookie)).status,502);f.fail(false);
 assert.equal((await f.req('/access',undefined,a.cookie)).data.ai.dele.corrections.remaining,1);
 assert.equal((await f.req('/submissions/'+submission.id+'/evaluate',{consent:true,key:'ignored-malicious-client-key',provider:'gemini'},a.cookie)).status,200);
 await f.req('/submissions/'+submission.id+'/evaluate',{consent:true},a.cookie);
 const other=(await f.req('/submissions',{kind:'writing',text:'Hola de nuevo.'},a.cookie)).data;
 const limited=await f.req('/submissions/'+other.id+'/evaluate',{consent:true},a.cookie);assert.equal(limited.status,429);assert.ok(limited.data.renewAt);
 const body={module:'dele',message:'Hola.',consent:true};assert.equal((await f.req('/tutor/chat',body,a.cookie)).status,200);assert.equal((await f.req('/tutor/chat',body,a.cookie)).data.error,'ai_limit');
 f.runtime.db.prepare('UPDATE subscriptions SET period_start=period_start+1,paid_until=paid_until+86400*30 WHERE user_id=?').run(a.id);
 assert.equal((await f.req('/access',undefined,a.cookie)).data.ai.dele.corrections.remaining,1);
 assert.equal((await f.req('/submissions/'+other.id+'/evaluate',{consent:true},a.cookie)).status,200);
 assert.ok(!JSON.stringify((await f.req('/export',undefined,a.cookie)).data).includes(testAIConfig.key));
 const c=await f.account('ccse-tutor');grantPlan(f.runtime.db,c.id,'ccse');assert.equal((await f.req('/access',undefined,c.cookie)).data.ai.ccse.corrections.remaining,0);assert.equal((await f.req('/tutor/chat',{...body,module:'ccse'},c.cookie)).status,200);
});
test('missing server AI configuration is unavailable, does not accept client keys and consumes no allowance',async t=>{
 const f=await fixture(t,{aiConfig:{...testAIConfig,key:''}}),a=await f.account();grantPlan(f.runtime.db,a.id);
 assert.equal((await f.req('/access',undefined,a.cookie)).data.ai.dele.available,false);
 assert.equal((await f.req('/tutor/chat',{message:'Hola',consent:true,key:'client-key-cannot-enable-ai'},a.cookie)).data.error,'ai_unavailable');assert.equal(f.calls(),0);assert.equal(f.runtime.db.prepare('SELECT COUNT(*) n FROM ai_usage').get().n,0);
});
test('one active session by default, configurable maximum and distinct replacement reason',async t=>{
 const f=await fixture(t),a=await f.account();const login=await f.req('/auth/login',{email:a.email,password:'test-password-123'});
 assert.equal((await f.req('/me',undefined,a.cookie)).data.error,'session_replaced');assert.equal((await f.req('/progress',undefined,a.cookie)).data.error,'session_replaced');assert.ok((await f.req('/me',undefined,login.cookie)).data.user);
 const g=await fixture(t,{emailConfig:{production:true,maxSessions:2}}),b=await g.account();const second=await g.req('/auth/login',{email:b.email,password:'test-password-123'});assert.ok((await g.req('/me',undefined,b.cookie)).data.user);
 const third=await g.req('/auth/login',{email:b.email,password:'test-password-123'});assert.equal((await g.req('/me',undefined,b.cookie)).data.error,'session_replaced');assert.ok((await g.req('/me',undefined,second.cookie)).data.user);assert.ok((await g.req('/me',undefined,third.cookie)).data.user);
});
test('verification is single-use and required before checkout; consent is also enforced on the server',async t=>{
 const f=await fixture(t),a=await f.account(),token=f.token();
 const body={plan:'both',termsAccepted:true,immediateAccess:true};assert.equal((await f.req('/billing/checkout',body,a.cookie)).data.error,'email_verification_required');
 const row=f.runtime.db.prepare('SELECT * FROM account_tokens WHERE user_id=?').get(a.id);assert.notEqual(row.hash,token);assert.equal(row.hash.length,64);
 assert.equal((await f.req('/auth/verify-email',{token})).status,200);assert.equal((await f.req('/auth/verify-email',{token})).status,400);
 assert.ok((await f.req('/me',undefined,a.cookie)).data.user.email_verified_at);
 assert.equal((await f.req('/billing/checkout',{plan:'both'},a.cookie)).data.error,'checkout_consent_required');assert.equal((await f.req('/billing/checkout',body,a.cookie)).data.error,'billing_not_ready');
});
test('password reset has identical request responses, one-hour tokens and invalidates every session',async t=>{
 let now=new Date();const f=await fixture(t,{clock:()=>now}),a=await f.account();
 const known=await f.req('/auth/forgot-password',{email:a.email}),token=f.token(),unknown=await f.req('/auth/forgot-password',{email:'missing@example.test'});assert.equal(known.status,unknown.status);assert.deepEqual(known.data,unknown.data);
 assert.equal((await f.req('/auth/reset-password',{token,password:'changed-password-123'})).status,200);assert.equal((await f.req('/auth/reset-password',{token,password:'changed-again-123'})).status,400);
 assert.equal((await f.req('/me',undefined,a.cookie)).data.user,null);assert.equal((await f.req('/auth/login',{email:a.email,password:'test-password-123'})).status,401);assert.equal((await f.req('/auth/login',{email:a.email,password:'changed-password-123'})).status,200);
 await f.req('/auth/forgot-password',{email:a.email});const expired=f.token();now=new Date(now.getTime()+3600001);assert.equal((await f.req('/auth/reset-password',{token:expired,password:'another-password-123'})).status,400);
});
test('unconfigured production email never logs recovery or verification links',async t=>{
 const f=await fixture(t,{emailConfig:{production:true,maxSessions:1}}),a=await f.account();await f.req('/auth/forgot-password',{email:a.email});assert.deepEqual(f.logs,[]);assert.equal((await f.req('/access',undefined,a.cookie)).data.emailAvailable,false);
});
test('additive migrations preserve existing accounts, sessions, lesson progress and subscriptions across restarts',t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'rumbo-migration-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const legacy=new DatabaseSync(path.join(directory,'rumbo.sqlite'));
 legacy.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL,language TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE completions(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,lesson_id TEXT NOT NULL,completed_at TEXT NOT NULL,PRIMARY KEY(user_id,lesson_id));
 CREATE TABLE subscriptions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,customer_id TEXT NOT NULL,plan TEXT,status TEXT NOT NULL,paid_until INTEGER NOT NULL DEFAULT 0,cancel_at_period_end INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
 CREATE TABLE tutor_conversations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,mode TEXT NOT NULL,created_at TEXT NOT NULL);`);
 const now=new Date().toISOString(),hash=createHash('sha256').update('legacy-session-token').digest('hex');
 legacy.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run('legacy-user','Ana','ana@example.test','existing-password-hash','existing-salt','pt-PT',now);
 legacy.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash,'legacy-user',Date.now()+86400000);
 legacy.prepare('INSERT INTO completions VALUES (?,?,?)').run('legacy-user','c1',now);
 legacy.prepare('INSERT INTO subscriptions VALUES (?,?,?,?,?,?,?,?)').run('legacy-sub','legacy-user','legacy-customer','both','active',Math.floor(Date.now()/1000)+86400,0,now);
 legacy.prepare('INSERT INTO tutor_conversations VALUES (?,?,?,?)').run('legacy-chat','legacy-user','conversation',now);legacy.close();
 for(let restart=0;restart<2;restart++){
  const {db}=createApp({dataDir:directory,secure:false,emailConfig:{production:true,maxSessions:1}});
  try{
   assert.equal(db.prepare('SELECT password FROM users WHERE id=?').get('legacy-user').password,'existing-password-hash');
   assert.equal(db.prepare('SELECT email_verified_at FROM users').get().email_verified_at,null);
   assert.equal(db.prepare('SELECT token,revoked_reason FROM sessions').get().token,hash);
   assert.equal(db.prepare('SELECT revoked_reason FROM sessions').get().revoked_reason,null);
   assert.equal(db.prepare('SELECT lesson_id FROM completions').get().lesson_id,'c1');
   assert.equal(db.prepare('SELECT plan,period_start FROM subscriptions').get().plan,'both');
   assert.equal(db.prepare('SELECT period_start FROM subscriptions').get().period_start,0);
   assert.equal(db.prepare('SELECT module FROM tutor_conversations').get().module,'dele');
   assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
 }
});
test('transactional email uses each service protocol without real network requests',async()=>{
 assert.equal(emailConfiguration({}).maxSessions,1);assert.equal(emailConfiguration({MAX_SESSIONS_PER_USER:'2.9'}).maxSessions,2);
 for(const provider of ['resend','postmark']){
  let call;
  await deliverEmail({provider,key:'fixture-email-key',from:'study@example.test'},{to:'ana@example.test',subject:'Verify',text:'Fixture link'},async(url,options)=>{call={url,...options};return{ok:true};});
  const body=JSON.parse(call.body);
  assert.equal(call.url,provider==='postmark'?'https://api.postmarkapp.com/email':'https://api.resend.com/emails');
  assert.equal(provider==='postmark'?body.To:body.to[0],'ana@example.test');
  assert.ok(call.signal);assert.equal(provider==='postmark'?call.headers['X-Postmark-Server-Token']:call.headers.Authorization,provider==='postmark'?'fixture-email-key':'Bearer fixture-email-key');
 }
 await assert.rejects(()=>deliverEmail({provider:'resend',key:'fixture',from:'study@example.test'},{to:'ana@example.test',subject:'Verify',text:'Fixture'},async()=>({ok:false})),/email_unavailable/);
});
