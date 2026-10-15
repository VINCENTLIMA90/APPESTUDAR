import {randomBytes} from 'node:crypto';
import {studyDate,nextReview} from './learning.js';
import {civicCategories} from './question-bank.js';
export function installFacts(db,bank,{clock=()=>new Date()}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS fact_attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,fact_id TEXT NOT NULL,question_id TEXT NOT NULL,correct INTEGER NOT NULL,study_day TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS fact_attempts_user ON fact_attempts(user_id,fact_id,created_at);
 CREATE TABLE IF NOT EXISTS fact_migrations(id TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS learning_steps(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,step_id TEXT NOT NULL,completed_at TEXT NOT NULL,PRIMARY KEY(user_id,step_id));`);
 const key=factId=>'fact:'+factId;
 function migrate(){
  if(db.prepare("SELECT 1 FROM fact_migrations WHERE id='legacy-v1'").get())return;
  db.exec('BEGIN IMMEDIATE');try{
   const groups=new Map();for(const state of db.prepare("SELECT * FROM review_state WHERE kind='question'").all()){
    const q=bank.get(state.item_id);if(!q)continue;const id=state.user_id+':'+q.factId,previous=groups.get(id);
    if(!previous)groups.set(id,{...state,item_id:key(q.factId),kind:'fact'});else{previous.due_at=[previous.due_at,state.due_at].sort()[0];previous.interval_days=Math.min(previous.interval_days,state.interval_days);previous.lapses+=state.lapses;previous.repetitions=Math.max(previous.repetitions,state.repetitions);previous.updated_at=[previous.updated_at,state.updated_at].sort().at(-1);}
   }
   const insert=db.prepare('INSERT OR IGNORE INTO review_state VALUES (?,?,?,?,?,?,?,?)');for(const row of groups.values())insert.run(row.user_id,row.item_id,row.kind,row.interval_days,row.repetitions,row.lapses,row.due_at,row.updated_at);
   for(const quiz of db.prepare('SELECT id,user_id,result,created_at FROM quizzes WHERE result IS NOT NULL').all())for(const a of JSON.parse(quiz.result).answers||[]){const q=bank.get(a.id);if(q)observe(quiz.user_id,q,!!a.isCorrect,'legacy:'+quiz.id+':'+a.id,JSON.parse(quiz.result).finishedAt||quiz.created_at,false);}
   db.prepare('INSERT INTO fact_migrations VALUES (?)').run('legacy-v1');db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 function observe(userId,q,correct,eventId,at=clock().toISOString(),schedule=true){
  const inserted=db.prepare('INSERT OR IGNORE INTO fact_attempts VALUES (?,?,?,?,?,?,?)').run(eventId,userId,q.factId,q.id,correct?1:0,studyDate(at),at).changes;if(!inserted||!schedule)return;
  const id=key(q.factId),previous=db.prepare('SELECT * FROM review_state WHERE user_id=? AND item_id=?').get(userId,id),state=nextReview(previous,correct?'good':'again',new Date(at));
  db.prepare('INSERT INTO review_state VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET interval_days=excluded.interval_days,repetitions=excluded.repetitions,lapses=excluded.lapses,due_at=excluded.due_at,updated_at=excluded.updated_at').run(userId,id,'fact',state.interval_days,state.repetitions,state.lapses,state.due_at,state.updated_at);
 }
 function variant(userId,group){const failed=db.prepare('SELECT question_id FROM fact_attempts WHERE user_id=? AND fact_id=? AND correct=0 ORDER BY created_at DESC,rowid DESC LIMIT 1').get(userId,group[0].factId);return group.find(q=>q.id!==failed?.question_id)||group[0];}
 function groups(){return [...Map.groupBy(bank.approved(),q=>q.factId).values()];}
 function cards(userId){return groups().map(group=>{const q=variant(userId,group);return{id:key(q.factId),factId:q.factId,questionId:q.id,variantType:q.variantType,kind:'question',module:q.module,category:q.category,front:q.prompt,back:q.options[q.correct],example:q.explanation,source:q.source};});}
 function errors(userId,module){return groups().filter(group=>group[0].module===module).filter(group=>db.prepare('SELECT correct FROM fact_attempts WHERE user_id=? AND fact_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(userId,group[0].factId)?.correct===0).map(group=>variant(userId,group));}
 function mastery(userId){const rows=db.prepare('SELECT fact_id,question_id,study_day FROM fact_attempts WHERE user_id=? AND correct=1').all(userId),won=new Set();for(const [id,attempts]of Map.groupBy(rows,r=>r.fact_id))if(new Set(attempts.map(a=>a.question_id)).size>=2&&new Set(attempts.map(a=>a.study_day)).size>=2)won.add(id);return civicCategories.map(category=>{const selected=groups().filter(g=>g[0].module==='ccse'&&g[0].category===category);return{category,total:selected.length,mastered:selected.filter(g=>won.has(g[0].factId)).length};});}
 migrate();return{observe,cards,errors,mastery};
}
