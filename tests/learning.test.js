import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {nextReview,estimatePlan,skillSummary,DAY} from '../server/learning.js';
import {gradeModel} from '../server/exam.js';
import {grantPlan,testAIConfig} from './helpers.js';
import {createApp} from '../server/app.js';
test('review delays grow for remembered cards and reset to ten minutes after a lapse',()=>{
 const now=new Date('2026-10-15T10:00:00Z');
 const first=nextReview(null,'good',now),second=nextReview(first,'good',now),easy=nextReview(second,'easy',now),again=nextReview(easy,'again',now);
 assert.equal(Date.parse(first.due_at)-now.getTime(),DAY);assert.ok(second.interval_days>first.interval_days);assert.ok(easy.interval_days>second.interval_days);
 assert.equal(Date.parse(again.due_at)-now.getTime(),600000);assert.equal(again.repetitions,0);assert.equal(again.lapses,1);
});
test('forecast responds to frequency, evidence and goal without claiming CEFR certification',()=>{
 const settings={goal:'both',sessions_week:3,session_minutes:30,target_date:null};
 const baseline=[{mode:'assessment',created_at:'2026-10-15',result:{answers:[{module:'dele',category:'reading',isCorrect:true},{module:'dele',category:'listening',isCorrect:false},{module:'ccse',category:'government',isCorrect:true}]}}];
 const slow=estimatePlan(settings,baseline,[],new Date('2026-10-15T12:00:00Z')),fast=estimatePlan({...settings,sessions_week:6},baseline,[],new Date('2026-10-15T12:00:00Z'));
 assert.ok(fast.weeks<slow.weeks);assert.ok(fast.upperWeeks>fast.weeks);assert.equal(slow.provisional,true);assert.equal(slow.method,'heuristic-v1');
 const complete=estimatePlan(settings,baseline,[{kind:'writing'},{kind:'speaking'}]);assert.equal(complete.provisional,false);
 assert.equal(Object.keys(estimatePlan({...settings,goal:'ccse'},baseline,[]).modules).join(), 'ccse');
 assert.equal(skillSummary(baseline,[{kind:'speaking',feedback:'{}'}]).find(s=>s.id==='speaking').percent,null);
});
test('official answer keys grade A–K correctly, including the listening matching task',()=>{
 const reading='C B B A C B C B C B B A A B B A C C B B C A A C C'.split(' '),listening='C B A C B C B C B C A A B C B B A C H K D I E C A'.split(' ');
 assert.equal(gradeModel('reading',reading).filter(a=>a.isCorrect).length,25);assert.equal(gradeModel('listening',listening).filter(a=>a.isCorrect).length,25);
 assert.equal(gradeModel('listening',listening)[19].correct,10);assert.equal(gradeModel('reading',Array(25).fill(null)).filter(a=>a.isCorrect).length,0);
});

let runtime,server,base;const dir=mkdtempSync(path.join(tmpdir(),'rumbo-learning-'));
before(async()=>{
 runtime=createApp({dataDir:dir,secure:false,aiConfig:{...testAIConfig,key:'test-key-transient'},tutor:async({key,messages,context})=>{assert.equal(key,'test-key-transient');assert.ok(Array.isArray(messages));return{reply:'Vamos a practicar.',correction:'Usa el pasado.',question:'¿Qué hiciste ayer?',focus:'Pasado',provider:'openai',model:'test'};}});
 server=await new Promise(resolve=>{const s=runtime.app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));runtime.db.close();rmSync(dir,{recursive:true,force:true});});
async function req(route,body,cookie,method){const r=await fetch(base+'/api'+route,{method:method||(body===undefined?'GET':'POST'),headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function account(name){const result=await req('/auth/register',{name,email:name+'@example.test',password:'a-good-test-password',language:'pt-PT'});grantPlan(runtime.db,result.data.user.id);return result;}
test('plan saves and recalculates while protecting another user’s settings',async()=>{
 const a=await account('plan-a'),b=await account('plan-b');
 assert.equal((await req('/plan',undefined,undefined)).status,401);
 const initial=(await req('/plan',undefined,a.cookie)).data;
 assert.equal((await req('/plan',{goal:'both',sessions_week:6,session_minutes:60},a.cookie,'PUT')).status,200);
 const changed=(await req('/plan',undefined,a.cookie)).data;assert.ok(changed.estimate.weeks<initial.estimate.weeks);assert.equal(changed.settings.sessions_week,6);
 assert.equal((await req('/plan',undefined,b.cookie)).data.settings.sessions_week,3);
 assert.equal((await req('/plan',{goal:'both',sessions_week:0,session_minutes:30},a.cookie,'PUT')).status,400);
 assert.equal((await req('/plan',{goal:'both',sessions_week:3,session_minutes:30,target_date:'2027-02-31'},a.cookie,'PUT')).status,400);
});
test('spaced vocabulary reviews persist per account and contribute activity without exam scores',async()=>{
 const a=await account('review-a'),b=await account('review-b');
 const before=(await req('/review?kind=vocabulary',undefined,a.cookie)).data;
 const card=before.cards[0];const rated=await req('/review/'+card.id+'/rate',{rating:'good'},a.cookie);assert.equal(rated.status,200);
 const after=(await req('/review?kind=vocabulary',undefined,a.cookie)).data;assert.equal(after.newCount,before.newCount-1);assert.ok(!after.cards.some(c=>c.id===card.id));
 const progress=(await req('/progress',undefined,a.cookie)).data;assert.equal(progress.reviewCount,1);assert.equal(progress.results.length,0);assert.ok(progress.streak>0);
 assert.equal((await req('/review?kind=vocabulary',undefined,b.cookie)).data.newCount,before.newCount);
 assert.equal((await req('/review/'+card.id+'/rate',{rating:'bogus'},a.cookie)).status,400);
});
test('guided DELE retains answers, grades objective sections and links writing to the owner’s attempt',async()=>{
 const a=await account('exam-a'),b=await account('exam-b');
 const attempt=(await req('/exams',{},a.cookie)).data;assert.equal(attempt.stage,'reading');assert.ok(attempt.deadline);
 assert.equal((await req('/exams/'+attempt.id,undefined,b.cookie)).status,404);
 const answers=Array(25).fill('C');assert.equal((await req('/exams/'+attempt.id+'/answers',{stage:'reading',answers},a.cookie,'PATCH')).status,200);
 assert.deepEqual((await req('/exams/'+attempt.id,undefined,a.cookie)).data.answers.reading,answers);
 const read=await req('/exams/'+attempt.id+'/advance',{stage:'reading',answers},a.cookie);assert.equal(read.status,200);assert.equal(read.data.stage,'listening');assert.equal(read.data.results[0].total,25);
 assert.equal((await req('/exams/'+attempt.id+'/advance',{stage:'reading',answers},a.cookie)).status,409);
 assert.equal((await req('/exams/'+attempt.id+'/advance',{stage:'listening',answers:Array(25).fill('K')},a.cookie)).status,400);
 await req('/exams/'+attempt.id+'/advance',{stage:'listening',answers:Array(25).fill(null)},a.cookie);
 const submission=await req('/submissions',{kind:'writing',text:'Hola, amigo. Me gusta mi ciudad y mi trabajo.',task_id:'model-writing-1',exam_id:attempt.id},a.cookie);assert.equal(submission.status,201);
 assert.equal((await req('/submissions',{kind:'writing',text:'Hola.',task_id:'model-writing-1',exam_id:attempt.id},b.cookie)).status,409);
 assert.equal((await req('/exams/'+attempt.id,undefined,a.cookie)).data.submissions['model-writing-1'].id,submission.data.id);
 await req('/exams/'+attempt.id+'/advance',{stage:'writing'},a.cookie);await req('/exams/'+attempt.id+'/advance',{stage:'preparation'},a.cookie);
 const done=(await req('/exams/'+attempt.id+'/advance',{stage:'speaking'},a.cookie)).data;assert.equal(done.stage,'done');assert.equal(done.results.length,2);assert.equal(Object.keys(done.submissions).length,1);
 const p=(await req('/progress',undefined,a.cookie)).data;assert.equal(p.results.length,2);assert.equal(p.skills.find(s=>s.id==='writing').percent,null);
});
test('tutor remembers turns, requires explicit consent and never persists the API key',async()=>{
 const a=await account('tutor-a'),b=await account('tutor-b');const body={provider:'openai',key:'test-key-transient',mode:'conversation',message:'Ayer voy al parque.',consent:true};
 assert.equal((await req('/tutor/chat',{...body,consent:false},a.cookie)).status,400);
 const first=await req('/tutor/chat',body,a.cookie);assert.equal(first.status,200);assert.equal(first.data.messages.length,2);
 const second=await req('/tutor/chat',{...body,message:'Fui con mi hermana.',conversationId:first.data.id},a.cookie);assert.equal(second.data.messages.length,4);
 assert.equal((await req('/tutor/chat',{...body,conversationId:first.data.id},b.cookie)).status,404);
 assert.equal((await req('/tutor',undefined,b.cookie)).data.conversations.length,0);
 assert.equal(JSON.stringify((await req('/export',undefined,a.cookie)).data).includes('test-key-transient'),false);
 await req('/me',{},a.cookie,'DELETE');assert.equal(runtime.db.prepare('SELECT COUNT(*) AS n FROM tutor_messages').get().n,0);
});
test('changed official key files suspend creation of a graded model',async()=>{
 const temp=mkdtempSync(path.join(tmpdir(),'rumbo-model-audit-'));
 const other=createApp({dataDir:temp,secure:false,sourceFetch:async()=>new Response('%PDF-unexpected-new-version',{headers:{'content-type':'application/pdf'}})});
 try{await other.checkSources();const rows=other.db.prepare('SELECT * FROM model_audits').all();assert.equal(rows.length,2);assert.ok(rows.every(row=>row.status==='changed'));}finally{other.db.close();rmSync(temp,{recursive:true,force:true});}
});
