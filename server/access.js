import {randomBytes} from 'node:crypto';

const integer=(value,fallback)=>/^\d+$/.test(String(value??''))?Math.min(100000,Number(value)):fallback;
export function aiConfiguration(env=process.env){
  return {provider:env.AI_PROVIDER||'',key:env.AI_API_KEY||'',model:env.AI_MODEL||'',transcribeModel:env.AI_TRANSCRIBE_MODEL||'',limits:{
    ccse:{corrections:integer(env.AI_CCSE_CORRECTIONS_LIMIT,0),tutor:integer(env.AI_CCSE_TUTOR_LIMIT,50)},
    dele:{corrections:integer(env.AI_DELE_CORRECTIONS_LIMIT,30),tutor:integer(env.AI_DELE_TUTOR_LIMIT,300)},
    both:{corrections:integer(env.AI_BOTH_CORRECTIONS_LIMIT,30),tutor:integer(env.AI_BOTH_TUTOR_LIMIT,300)}}};
}
export function installAccess(db,billing,{config=aiConfiguration(),clock=()=>new Date()}={}){
  db.exec(`CREATE TABLE IF NOT EXISTS free_trials(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,module TEXT NOT NULL,quiz_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,module));
    CREATE TABLE IF NOT EXISTS ai_usage(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,cycle_id TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS ai_usage_cycle ON ai_usage(user_id,cycle_id,kind);`);
  const modules=userId=>billing.summary(userId).modules;
  const has=(userId,module)=>modules(userId).includes(module);
  function guard(module){return(req,res,next)=>has(req.user.id,typeof module==='function'?module(req):module)?next():res.status(402).json({error:'subscription_required',module:typeof module==='function'?module(req):module});}
  function cycle(userId,module){
    const rows=db.prepare('SELECT * FROM subscriptions WHERE user_id=? AND status IN (\'active\',\'trialing\') AND paid_until>? ORDER BY CASE plan WHEN \'both\' THEN 0 ELSE 1 END,paid_until DESC').all(userId,clock().getTime()/1000);
    const row=rows.find(row=>row.plan==='both'||row.plan===module);
    if(!row||!config.limits[row.plan])return null;
    let start=row.period_start;
    if(!start){const date=new Date(row.paid_until*1000),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-1);date.setUTCDate(Math.min(day,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()));start=date.getTime()/1000;}
    return {id:row.id+':'+start,renewAt:new Date(row.paid_until*1000).toISOString(),limits:config.limits[row.plan],plan:row.plan};
  }
  const available=()=>['openai','anthropic','gemini'].includes(config.provider)&&typeof config.key==='string'&&config.key.length>=10&&config.key.length<=1024&&Boolean(config.model);
  function usage(userId,module){
    const current=cycle(userId,module),counts={};
    for(const kind of ['corrections','tutor']){
      const used=current?db.prepare("SELECT COUNT(*) n FROM ai_usage WHERE user_id=? AND cycle_id=? AND kind=? AND (state='used' OR (state='reserved' AND created_at>?))").get(userId,current.id,kind,clock().getTime()-600000).n:0;
      const limit=current?.limits[kind]||0;counts[kind]={limit,used,remaining:Math.max(0,limit-used)};
    }
    return {available:available(),speakingAvailable:available()&&(config.provider!=='openai'||Boolean(config.transcribeModel)),renewAt:current?.renewAt||null,...counts};
  }
  function reserve(userId,module,kind){
    if(!has(userId,module))throw Object.assign(new Error('subscription_required'),{status:402});
    if(!available())throw Object.assign(new Error('ai_unavailable'),{status:503});
    db.exec('BEGIN IMMEDIATE');
    try{
      const current=cycle(userId,module),state=usage(userId,module);
      if(!current||!state[kind].remaining)throw Object.assign(new Error('ai_limit'),{status:429,renewAt:state.renewAt});
      const id=randomBytes(16).toString('hex');db.prepare('INSERT INTO ai_usage VALUES (?,?,?,?,?,?)').run(id,userId,current.id,kind,'reserved',clock().getTime());db.exec('COMMIT');return id;
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  const finish=(id,success)=>success?db.prepare("UPDATE ai_usage SET state='used' WHERE id=?").run(id):db.prepare('DELETE FROM ai_usage WHERE id=?').run(id);
  function quizAllowed(userId,quiz){return quiz.mode==='assessment'||has(userId,quiz.module)||Boolean(db.prepare('SELECT 1 FROM free_trials WHERE user_id=? AND module=? AND quiz_id=?').get(userId,quiz.module,quiz.id));}
  function claimTrial(userId,module,quizId){if(has(userId,module))return true;return db.prepare('INSERT OR IGNORE INTO free_trials VALUES (?,?,?,?)').run(userId,module,quizId,clock().toISOString()).changes===1;}
  function summary(userId){return {modules:modules(userId),trials:Object.fromEntries(['ccse','dele'].map(module=>[module,!db.prepare('SELECT 1 FROM free_trials WHERE user_id=? AND module=?').get(userId,module)])),ai:Object.fromEntries(['ccse','dele'].map(module=>[module,usage(userId,module)]))};}
  return {has,modules,guard,config,usage,reserve,finish,quizAllowed,claimTrial,summary};
}
