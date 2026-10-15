import {randomBytes,randomInt} from 'node:crypto';
export function shuffled(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=randomInt(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;}
export function present(q){const order=shuffled(q.options.map((_,i)=>i));return{...q,options:order.map(i=>q.options[i]),correct:order.indexOf(q.correct)};}
export function installQuizzes(app,db,{requireUser,bank,billing,lessons,access,facts,clock=()=>new Date()}){
 if(!db.prepare('PRAGMA table_info(quizzes)').all().some(c=>c.name==='lesson_id'))db.exec('ALTER TABLE quizzes ADD COLUMN lesson_id TEXT');
 db.exec(`CREATE TABLE IF NOT EXISTS quiz_presentations(quiz_id TEXT PRIMARY KEY REFERENCES quizzes(id) ON DELETE CASCADE,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS quiz_theme_answers(quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,position INTEGER NOT NULL,answer INTEGER,feedback TEXT NOT NULL,PRIMARY KEY(quiz_id,position));`);
 const allowed=(userId,quiz)=>quiz.mode==='theme'?billing.canAccess(userId,lessons.find(l=>l.id===quiz.lesson_id)||{}):access.quizAllowed(userId,quiz);
 const snapshot=quiz=>{const row=db.prepare('SELECT data FROM quiz_presentations WHERE quiz_id=?').get(quiz.id);return row?JSON.parse(row.data):JSON.parse(quiz.question_ids).map(id=>bank.get(id));};
 const grade=(q,selected)=>({...q,selected,isCorrect:selected===q.correct,optionExplanations:q.options.map((option,i)=>i===q.correct?q.explanation:`«${option}» no corresponde al dato solicitado. ${q.explanation}`)});
 function find(req,res){const quiz=db.prepare('SELECT * FROM quizzes WHERE id=? AND user_id=?').get(req.params.id,req.user.id);if(!quiz){res.status(404).json({error:'not_found'});return null;}if(!allowed(req.user.id,quiz)){res.status(402).json({error:'subscription_required'});return null;}return quiz;}
 app.post('/api/quizzes',requireUser,(req,res)=>{
  const {module,mode,lessonId}=req.body;
  if(!['ccse','dele'].includes(module)||!['practice','simulation','assessment','review','theme'].includes(mode))return res.status(400).json({error:'invalid_quiz'});
  const lesson=mode==='theme'?lessons.find(l=>l.id===lessonId&&l.module===module):null;
  if(mode==='theme'&&!lesson)return res.status(400).json({error:'invalid_quiz'});
  if(mode==='theme'?!billing.canAccess(req.user.id,lesson):!['assessment','simulation'].includes(mode)&&!access.has(req.user.id,module))return res.status(402).json({error:'subscription_required',module});
  if(mode==='simulation'&&!access.has(req.user.id,module)&&!req.user.email_verified_at)return res.status(403).json({error:'trial_email_required'});
  const questions=bank.approved();let pool=questions.filter(q=>q.module===module),selected;
  if(mode==='assessment')selected=['reading','listening'].flatMap(category=>shuffled(questions.filter(q=>q.category===category)).slice(0,4)).concat(shuffled(questions.filter(q=>q.module==='ccse')).slice(0,4));
  else if(mode==='theme'){const linked=shuffled(pool.filter(q=>q.lessonIds.includes(lessonId))),first=linked[0],other=linked.find(q=>q.variantType!==first?.variantType);selected=[...new Set([first,other,...linked].filter(Boolean))].slice(0,8);if(selected.length<5)return res.status(409).json({error:'theme_not_ready'});}
  else if(mode==='review'){selected=shuffled(facts.errors(req.user.id,module)).slice(0,10);if(!selected.length)return res.status(400).json({error:'no_errors'});}
  else if(mode==='simulation'&&module==='ccse'){
   pool=pool.filter(q=>q.variantType==='exame');
   const groups=[['government',3,10],['rights',2,3],['geography',3,2],['culture',3,3],['society',3,7]];
   selected=groups.flatMap(([category,options,count])=>shuffled(pool.filter(q=>q.category===category&&q.options.length===options)).slice(0,count));
   if(selected.length!==25)return res.status(409).json({error:'quiz_bank_incomplete'});
  }else if(mode==='simulation')selected=['reading','listening'].flatMap(c=>shuffled(pool.filter(q=>q.category===c&&q.variantType==='exame')).slice(0,8));
  else selected=shuffled(pool).slice(0,10);
  if(!selected.length)return res.status(409).json({error:'quiz_bank_incomplete'});
  const id=randomBytes(16).toString('hex'),now=clock().toISOString(),presented=selected.map(present);
  db.exec('BEGIN IMMEDIATE');try{
   if(mode==='simulation'&&!access.claimTrial(req.user.id,module,id)){db.exec('ROLLBACK');return res.status(402).json({error:'subscription_required',module});}
   db.prepare('INSERT INTO quizzes(id,user_id,module,mode,question_ids,created_at,result,lesson_id) VALUES (?,?,?,?,?,?,NULL,?)').run(id,req.user.id,module,mode,JSON.stringify(selected.map(q=>q.id)),now,lesson?.id||null);
   db.prepare('INSERT INTO quiz_presentations VALUES (?,?)').run(id,JSON.stringify(presented));db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  res.status(201).json({id,module,mode,lessonId:lesson?.id||null,startedAt:now,minutes:mode==='simulation'?(module==='ccse'?45:35):null,questions:presented.map(({correct,explanation,source,...q})=>q)});
 });
 app.post('/api/quizzes/:id/answer',requireUser,(req,res)=>{
  const quiz=find(req,res);if(!quiz)return;if(quiz.mode!=='theme'||quiz.result)return res.status(409).json({error:'invalid_quiz'});
  const {index,answer}=req.body,qs=snapshot(quiz);if(!Number.isInteger(index)||!qs[index]||!Number.isInteger(answer)||answer<0||answer>=qs[index].options.length)return res.status(400).json({error:'invalid_answers'});
  const prior=db.prepare('SELECT feedback FROM quiz_theme_answers WHERE quiz_id=? AND position=?').get(quiz.id,index);if(prior)return res.json(JSON.parse(prior.feedback));
  const feedback=grade(qs[index],answer);db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO quiz_theme_answers VALUES (?,?,?,?)').run(quiz.id,index,answer,JSON.stringify(feedback));facts.observe(req.user.id,qs[index],feedback.isCorrect,quiz.id+':'+index);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}res.json(feedback);
 });
 app.post('/api/quizzes/:id/submit',requireUser,(req,res)=>{
  const quiz=find(req,res);if(!quiz)return;if(quiz.result)return res.json(JSON.parse(quiz.result));
  if(quiz.mode==='simulation'&&clock().getTime()>Date.parse(quiz.created_at)+(quiz.module==='ccse'?45:35)*60000+10000)return res.status(410).json({error:'quiz_expired'});
  const qs=snapshot(quiz);if(qs.some(q=>!q))return res.status(409).json({error:'quiz_content_changed'});
  let answers=req.body.answers;if(!Array.isArray(answers)||answers.length!==qs.length||answers.some((a,i)=>a!==null&&(!Number.isInteger(a)||a<0||a>=qs[i].options.length)))return res.status(400).json({error:'invalid_answers'});
  if(quiz.mode==='theme'){const saved=new Map(db.prepare('SELECT position,answer FROM quiz_theme_answers WHERE quiz_id=?').all(quiz.id).map(r=>[r.position,r.answer]));answers=qs.map((_,i)=>saved.get(i)??null);}
  const graded=qs.map((q,i)=>grade(q,answers[i])),score=graded.filter(q=>q.isCorrect).length,skills=Object.fromEntries([...new Set(graded.map(q=>q.category))].map(category=>{const group=graded.filter(q=>q.category===category);return[category,{correct:group.filter(q=>q.isCorrect).length,total:group.length}];}));
  const result={id:quiz.id,module:quiz.module,mode:quiz.mode,score,total:qs.length,percent:Math.round(score/qs.length*100),skills,answers:graded,finishedAt:clock().toISOString()};
  db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE quizzes SET result=? WHERE id=?').run(JSON.stringify(result),quiz.id);for(const [i,q]of graded.entries())facts.observe(req.user.id,q,q.isCorrect,quiz.id+':'+i);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}res.json(result);
 });
}
