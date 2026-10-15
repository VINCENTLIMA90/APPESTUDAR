import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readMaster,validateCSV,encodeCSV,installQuestionBank,masterFile,civicCategories} from '../server/question-bank.js';
import {createApp} from '../server/app.js';
import {grantPlan} from './helpers.js';
import {installFacts} from '../server/facts.js';
const master=readMaster(),raw=records=>encodeCSV(records.map(r=>({...r,correct:r.correct+1}))),copy=records=>structuredClone(records);
async function fixture(t,options={}){
 const dir=mkdtempSync(path.join(tmpdir(),'rumbo-facts-test-')),mail=[];let now=new Date('2026-10-15T12:00:00Z');
 const runtime=createApp({dataDir:dir,secure:false,clock:()=>now,emailConfig:{provider:'resend',key:'fixture-email-key',from:'study@example.test',origin:'https://study.example.test',production:true,maxSessions:1},emailSend:async(_config,message)=>mail.push(message),...options});
 const server=await new Promise(resolve=>{const s=runtime.app.listen(0,'127.0.0.1',()=>resolve(s));}),base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));runtime.db.close();rmSync(dir,{recursive:true,force:true});});
 async function req(route,body,cookie){const response=await fetch(base+'/api'+route,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 async function register(paid=true){const account=await req('/auth/register',{name:'Ana',email:'ana@example.test',password:'test-password-123',language:'pt-PT',initialGoal:'ccse'});if(paid)grantPlan(runtime.db,account.data.user.id);return{id:account.data.user.id,cookie:account.cookie};}
 const answer=q=>q.options.indexOf(runtime.bank.get(q.id).options[runtime.bank.get(q.id).correct]);
 return{runtime,req,register,answer,mail,time:value=>{now=new Date(value);}};
}
test('master CSV preserves 103 approved questions and has 150 original draft facts, two variants each, across five categories',()=>{
 assert.equal(master.errors.length,0);assert.equal(master.records.filter(r=>r.status==='aprovada').length,103);
 for(const category of civicCategories){const rows=master.records.filter(r=>r.category===category&&r.status==='rascunho');assert.equal(rows.length,60);assert.equal(new Set(rows.map(r=>r.fact_id)).size,30);assert.ok(rows.every(r=>r.source.startsWith('https:')));}
 assert.ok(readFileSync(masterFile,'utf8').startsWith('\uFEFF'));
});
test('CSV parser accepts UTF-8, quoted semicolons/newlines and rejects invalid fields with line numbers before any import',()=>{
 const records=copy(master.records.slice(0,3));records[0].prompt='¿Texto; con "comillas"?\nSegunda línea';const valid=validateCSV(raw(records));assert.equal(valid.errors.length,0);assert.equal(valid.records[0].prompt,records[0].prompt);
 const bad=copy(records);bad[1].question_id=bad[0].question_id;bad[0].correct=8;bad[2].source='javascript:alert(1)';bad[2].status='other';bad[1].variant_type='invertida';
 const result=validateCSV(raw(bad));assert.ok(result.errors.length>=5);assert.ok(result.errors.every(e=>Number.isInteger(e.line)&&e.line>0));assert.ok(result.errors.some(e=>e.message.includes('no exame')));
 const db=new DatabaseSync(':memory:');try{const bank=installQuestionBank(db);bank.importRecords(valid);const count=bank.approved().length;assert.throws(()=>bank.importRecords(result),/Invalid CSV/);assert.equal(bank.approved().length,count);}finally{db.close();}
 const missing=validateCSV('fact_id;question_id\nf1;q1\n');assert.ok(missing.errors.some(e=>e.line===1));
});
test('only approved variants are used; CCSE simulation uses only exame, preserves five tasks and keeps shuffled correct answers server-side',async t=>{
 const f=await fixture(t),a=await f.register(),quiz=(await f.req('/quizzes',{module:'ccse',mode:'simulation'},a.cookie)).data;
 assert.equal(quiz.questions.length,25);assert.equal(quiz.minutes,45);assert.ok(quiz.questions.every(q=>q.variantType==='exame'&&!q.id.startsWith('ccse-2026-')&&q.correct===undefined&&q.explanation===undefined&&q.source===undefined));
 for(const [category,count]of [['government',10],['rights',3],['geography',2],['culture',3],['society',7]])assert.equal(quiz.questions.filter(q=>q.category===category).length,count);
 const snapshot=JSON.parse(f.runtime.db.prepare('SELECT data FROM quiz_presentations WHERE quiz_id=?').get(quiz.id).data);assert.ok(snapshot.every((q,i)=>q.options[q.correct]===quiz.questions[i].options[f.answer(quiz.questions[i])]));
 // Editing the bank after presentation cannot change the answer key of an in-flight attempt.
 f.runtime.db.prepare("UPDATE question_bank SET status='retirada' WHERE id=?").run(quiz.questions[0].id);
 const result=await f.req('/quizzes/'+quiz.id+'/submit',{answers:quiz.questions.map(f.answer)},a.cookie);assert.equal(result.data.score,25);
});
test('topic test uses 5–8 linked questions, grades each answer immediately and does not let a later answer replace it',async t=>{
 const f=await fixture(t),a=await f.register(false),created=await f.req('/quizzes',{module:'ccse',mode:'theme',lessonId:'c1'},a.cookie);assert.equal(created.status,201);const quiz=created.data;assert.ok(quiz.questions.length>=5&&quiz.questions.length<=8);assert.ok(quiz.questions.every(q=>q.lessonIds.includes('c1')));
 const first=await f.req('/quizzes/'+quiz.id+'/answer',{index:0,answer:f.answer(quiz.questions[0])},a.cookie);assert.equal(first.data.isCorrect,true);assert.ok(first.data.explanation);assert.ok(first.data.source);
 assert.deepEqual((await f.req('/quizzes/'+quiz.id+'/answer',{index:0,answer:(f.answer(quiz.questions[0])+1)%quiz.questions[0].options.length},a.cookie)).data,first.data);
 assert.equal((await f.req('/quizzes',{module:'ccse',mode:'theme',lessonId:'c3'},a.cookie)).status,402);
 assert.equal((await f.req('/quizzes',{module:'dele',mode:'simulation'},a.cookie)).data.error,'trial_email_required');
 assert.equal((await f.req('/quizzes',{module:'dele',mode:'assessment'},a.cookie)).status,201);
 const result=await f.req('/quizzes/'+quiz.id+'/submit',{answers:quiz.questions.map(()=>null)},a.cookie);assert.equal(result.data.score,1);
});
test('spaced review groups errors by fact and chooses another approved variant; mastery requires distinct variants and distinct Madrid dates',async t=>{
 const f=await fixture(t),a=await f.register(),records=copy(master.records),base=records.find(r=>r.module==='ccse'&&r.options.length===3);
 const other={...base,question_id:base.question_id+'-invertida',variant_type:'invertida',prompt:'Variante original para prueba de hechos.'};records.push(other);f.runtime.bank.importRecords({records,errors:[]});
 const q=f.runtime.bank.get(base.question_id),q2=f.runtime.bank.get(other.question_id);f.runtime.learning.facts.observe(a.id,q,false,'fail');
 f.time('2026-10-15T12:11:00Z');
 const review=(await f.req('/review?kind=question&module=ccse',undefined,a.cookie)).data,card=review.cards.find(c=>c.factId===q.factId);assert.ok(card);assert.equal(card.questionId,q2.id);
 assert.equal(review.cards.filter(c=>c.factId===q.factId).length,1);const reviewQuiz=(await f.req('/quizzes',{module:'ccse',mode:'review'},a.cookie)).data;assert.equal(reviewQuiz.questions[0].id,q2.id);
 f.runtime.learning.facts.observe(a.id,q,true,'ok1');f.runtime.learning.facts.observe(a.id,q2,true,'ok2');assert.equal(f.runtime.learning.facts.mastery(a.id).find(r=>r.category===q.category).mastered,0);
 f.time('2026-10-16T12:00:00Z');f.runtime.learning.facts.observe(a.id,q2,true,'ok3');assert.equal((await f.req('/progress',undefined,a.cookie)).data.facts.find(r=>r.category===q.category).mastered,1);
 // Replaying the same event cannot advance mastery or the schedule.
 const attempts=f.runtime.db.prepare('SELECT COUNT(*) n FROM fact_attempts').get().n;f.runtime.learning.facts.observe(a.id,q2,true,'ok3');assert.equal(f.runtime.db.prepare('SELECT COUNT(*) n FROM fact_attempts').get().n,attempts);
});
test('legacy question review schedules and logs remain intact while a fact schedule is created without repeated migration',async t=>{
 const f=await fixture(t),a=await f.register(),q=f.runtime.bank.approved()[0],now='2026-10-15T10:00:00Z';
 f.runtime.db.prepare("DELETE FROM fact_migrations WHERE id='legacy-v1'").run();f.runtime.db.prepare('INSERT INTO review_state VALUES (?,?,?,?,?,?,?,?)').run(a.id,q.id,'question',6,3,2,'2026-10-18T10:00:00Z',now);f.runtime.db.prepare('INSERT INTO review_log VALUES (?,?,?,?,?)').run('legacy-review',a.id,q.id,'hard',now);
 installFacts(f.runtime.db,f.runtime.bank);installFacts(f.runtime.db,f.runtime.bank);
 const old=f.runtime.db.prepare('SELECT * FROM review_state WHERE item_id=?').get(q.id),fact=f.runtime.db.prepare('SELECT * FROM review_state WHERE item_id=?').get('fact:'+q.factId);assert.equal(fact.due_at,old.due_at);assert.equal(fact.lapses,2);assert.equal(fact.repetitions,3);assert.equal(f.runtime.db.prepare('SELECT COUNT(*) n FROM review_log').get().n,1);
});
test('email verification gates only free simulations; an email delivery failure is recorded without links and shown after opening the app',async t=>{
 const logs=[],f=await fixture(t,{emailSend:async()=>{throw new Error('upstream mail failure');},logger:message=>logs.push(message)}),a=await f.register(false);
 assert.equal((await f.req('/lessons/c1',undefined,a.cookie)).status,200);assert.equal((await f.req('/quizzes',{module:'ccse',mode:'assessment'},a.cookie)).status,201);
 for(const module of ['ccse','dele'])assert.equal((await f.req('/quizzes',{module,mode:'simulation'},a.cookie)).data.error,'trial_email_required');
 const me=await f.req('/me',undefined,a.cookie);assert.equal(me.data.email.verificationFailed,true);const deliveries=f.runtime.db.prepare('SELECT * FROM email_deliveries').all();assert.equal(deliveries[0].status,'failed');assert.ok(!JSON.stringify(deliveries).includes('https:'));assert.ok(!JSON.stringify(deliveries).includes('token'));assert.deepEqual(logs,['Transactional email delivery failed.']);
 const originalCount=deliveries.length;await f.req('/auth/request-verification',{},a.cookie);assert.equal(f.runtime.db.prepare('SELECT COUNT(*) n FROM email_deliveries').get().n,originalCount);
 f.time('2026-10-15T12:01:01Z');await f.req('/auth/request-verification',{},a.cookie);assert.equal(f.runtime.db.prepare('SELECT COUNT(*) n FROM email_deliveries').get().n,originalCount+1);
 const known=await f.req('/auth/forgot-password',{email:'ana@example.test'}),unknown=await f.req('/auth/forgot-password',{email:'missing@example.test'});assert.equal(known.status,unknown.status);assert.deepEqual(known.data,unknown.data);
});
test('initial study goal can be CCSE without storing nationality; official manual completion survives a reload',async t=>{
 const f=await fixture(t),a=await f.register();assert.equal((await f.req('/plan',undefined,a.cookie)).data.settings.goal,'ccse');assert.equal((await f.req('/learning-steps/ccse-manual-2026',{},a.cookie)).status,200);assert.equal((await f.req('/progress',undefined,a.cookie)).data.learningSteps[0].step_id,'ccse-manual-2026');assert.ok(!f.runtime.db.prepare('PRAGMA table_info(users)').all().some(c=>c.name.includes('national')));
});

test('draft DELE questions cover each of the nine missing topics without exposing any unapproved question',()=>{
 for(const lesson of ['d5','d17','d18','d19','d20','d21','d22','d23','d24']){
  const rows=master.records.filter(r=>r.lesson_id===lesson&&r.fact_id.startsWith('dele-topic-'));assert.equal(rows.length,5);assert.ok(rows.every(r=>r.status==='rascunho'&&r.variant_type==='exame'&&r.source.startsWith('https:')));
 }
 assert.equal(master.records.length,448);assert.equal(master.records.filter(r=>r.status==='aprovada').length,103);
});
test('even when other approved variants are available, the simulator uses only exame and topic tests mix variant types',async t=>{
 const f=await fixture(t),a=await f.register(),records=copy(master.records);
 for(const base of records.filter(r=>r.module==='ccse'&&r.category==='government').slice(0,12))records.push({...base,question_id:base.question_id+'-alternate',variant_type:'invertida'});
 f.runtime.bank.importRecords({records,errors:[]});
 for(let i=0;i<3;i++){const quiz=(await f.req('/quizzes',{module:'ccse',mode:'simulation'},a.cookie)).data;assert.ok(quiz.questions.every(q=>q.variantType==='exame'));}
 const theme=(await f.req('/quizzes',{module:'ccse',mode:'theme',lessonId:'c1'},a.cookie)).data;assert.equal(new Set(theme.questions.map(q=>q.variantType)).size,2);
 const changed=copy(records);changed[0].fact_id='changed-fact';assert.throws(()=>f.runtime.bank.importRecords({records:changed,errors:[]}),/cannot change fact_id/);assert.equal(f.runtime.bank.get(records[0].question_id).factId,records[0].fact_id);
});

test('the actual import CLI accepts the master and rejects an invalid file without changing the database',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'rumbo-import-cli-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const script=fileURLToPath(new URL('../scripts/import-questions.js',import.meta.url)),env={...process.env,DATA_DIR:dir};
 const imported=spawnSync(process.execPath,[script,masterFile],{env,encoding:'utf8'});assert.equal(imported.status,0,imported.stderr);
 const records=copy(master.records);records[0].correct=7;const invalid=path.join(dir,'invalid.csv');writeFileSync(invalid,raw(records));
 const rejected=spawnSync(process.execPath,[script,invalid],{env,encoding:'utf8'});assert.equal(rejected.status,1);assert.match(rejected.stderr,/Line 2:/);
 const db=new DatabaseSync(path.join(dir,'rumbo.sqlite'));try{assert.equal(db.prepare("SELECT COUNT(*) n FROM question_bank WHERE status='aprovada'").get().n,103);assert.equal(db.prepare('SELECT COUNT(*) n FROM question_bank').get().n,448);}finally{db.close();}
});
