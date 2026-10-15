import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const masterFile=fileURLToPath(new URL('../content/questions.csv',import.meta.url));
export const columns=['fact_id','question_id','module','category','lesson_id','variant_type','prompt','option_1','option_2','option_3','correct','explanation','source','status','reviewed_at','edition','audio','lesson_ids'];
export const civicCategories=['government','rights','geography','culture','society'];
export function parseCSV(text){
 const rows=[];let cells=[],cell='',quoted=false,line=1,start=1;const errors=[];text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted)quoted=false;else if(!cell)quoted=true;else errors.push({line,message:'Unexpected quote'});}else if(c===';'&&!quoted){cells.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;cells.push(cell);if(cells.some(x=>x.trim()))rows.push({line:start,cells});cells=[];cell='';line++;start=line;}else{cell+=c;if(c==='\n')line++;}}
 if(quoted)errors.push({line:start,message:'Unclosed quoted field'});if(cell||cells.length){cells.push(cell);rows.push({line:start,cells});}
 return {rows,errors};
}
export function encodeCSV(rows){const quote=value=>/[;"\r\n]/.test(String(value??''))?'"'+String(value??'').replaceAll('"','""')+'"':String(value??'');return '\uFEFF'+columns.join(';')+'\n'+rows.map(row=>columns.map(c=>quote(row[c])).join(';')).join('\n')+'\n';}
export function validateCSV(text,{lessons}={}){
 const {rows,errors}=parseCSV(text),header=rows.shift()?.cells||[],required=columns.slice(0,16);for(const key of required)if(!header.includes(key))errors.push({line:1,message:'Missing column: '+key});
 if(new Set(header).size!==header.length)errors.push({line:1,message:'Duplicate column'});
 const records=[],ids=new Set(),facts=new Map();
 for(const row of rows){
  const data=Object.fromEntries(header.map((key,i)=>[key,(row.cells[i]||'').trim()])),error=message=>errors.push({line:row.line,message});
  if(row.cells.length!==header.length)error('Wrong number of columns');
  for(const key of required.filter(k=>!['option_3','reviewed_at'].includes(k)))if(!data[key])error('Required field: '+key);
  for(const key of ['fact_id','question_id','lesson_id'])if(!/^[a-zA-Z0-9_-]{1,100}$/.test(data[key]||''))error('Invalid identifier: '+key);
  if(ids.has(data.question_id))error('Duplicate question_id: '+data.question_id);ids.add(data.question_id);
  if(!['ccse','dele'].includes(data.module))error('Invalid module');
  if(!(data.module==='ccse'?civicCategories:['reading','listening','writing','speaking']).includes(data.category))error('Invalid category');
  if(!['exame','invertida','verdadeiro_falso','outra'].includes(data.variant_type))error('Invalid variant_type');
  if(!['rascunho','aprovada','retirada'].includes(data.status))error('Invalid status');
  const options=[data.option_1,data.option_2,data.option_3].filter(Boolean),correct=Number(data.correct);
  if(options.length<2||new Set(options).size!==options.length||!/^([123])$/.test(data.correct)||correct>options.length)error('Invalid options or correct answer');
  if(data.variant_type==='verdadeiro_falso'&&options.length!==2)error('True/false variants require two options');
  if(data.variant_type==='exame'&&options.length!==(data.module==='ccse'&&data.category==='rights'?2:3))error('Exam variants require three options, except CCSE rights (two options)');
  if(data.status==='aprovada'&&!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewed_at))error('Approved questions require reviewed_at');
  if(data.reviewed_at&&(!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewed_at)||!Number.isFinite(Date.parse(data.reviewed_at))||new Date(data.reviewed_at).toISOString().slice(0,10)!==data.reviewed_at))error('Invalid reviewed_at');
  if(!/^\d{4}$/.test(data.edition))error('Invalid edition');
  try{if(new URL(data.source.split(/\s/)[0]).protocol!=='https:')error('Source must use HTTPS');}catch{error('Invalid factual source URL');}
  const linked=[...new Set([data.lesson_id,...(data.lesson_ids||'').split(',').filter(Boolean)])];
  if(lessons&&linked.some(id=>!lessons.some(l=>l.id===id&&l.module===data.module)))error('Unknown lesson or module mismatch');
  const group=facts.get(data.fact_id)||[];group.push({...data,line:row.line});facts.set(data.fact_id,group);records.push({...data,line:row.line,options,correct:correct-1,lessonIds:linked});
 }
 for(const [id,group]of facts){if(!group.some(r=>r.variant_type==='exame'))errors.push({line:group[0].line,message:'fact_id has no exame variant: '+id});if(group.length>3)errors.push({line:group[0].line,message:'More than three variants: '+id});if(new Set(group.map(r=>r.module+':'+r.category)).size>1)errors.push({line:group[0].line,message:'Inconsistent fact module/category: '+id});if(new Set(group.map(r=>r.variant_type)).size!==group.length)errors.push({line:group[0].line,message:'Duplicate variant_type for fact: '+id});}
 return {records,errors};
}
export function readMaster(file=masterFile,options){const text=new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(file)),result=validateCSV(text,options);if(result.errors.length)throw Object.assign(new Error(result.errors.map(e=>'Line '+e.line+': '+e.message).join('\n')),{errors:result.errors});return {...result,hash:createHash('sha256').update(text).digest('hex')};}
export function questionFromRecord(r){return{id:r.question_id,factId:r.fact_id,module:r.module,category:r.category,lessonId:r.lesson_id,lessonIds:r.lessonIds,variantType:r.variant_type,prompt:r.prompt,options:r.options,correct:r.correct,explanation:r.explanation,source:r.source,audio:r.audio||'',edition:r.edition};}
export function installQuestionBank(db){
 db.exec(`CREATE TABLE IF NOT EXISTS question_bank(id TEXT PRIMARY KEY,fact_id TEXT NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS question_bank_fact ON question_bank(fact_id,status);
 CREATE TABLE IF NOT EXISTS question_bank_meta(id INTEGER PRIMARY KEY CHECK(id=1),hash TEXT NOT NULL,imported_at TEXT NOT NULL);`);
 function importRecords(result){if(result.errors?.length)throw new Error('Invalid CSV');const changed=result.records.filter(row=>{const existing=db.prepare('SELECT fact_id FROM question_bank WHERE id=?').get(row.question_id);return existing&&existing.fact_id!==row.fact_id;});if(changed.length)throw new Error(changed.map(row=>'Line '+(row.line||'?')+': existing question_id cannot change fact_id: '+row.question_id).join('\n'));db.exec('BEGIN IMMEDIATE');try{db.prepare("UPDATE question_bank SET status='retirada'").run();const insert=db.prepare('INSERT INTO question_bank VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET fact_id=excluded.fact_id,status=excluded.status,data=excluded.data');for(const row of result.records)insert.run(row.question_id,row.fact_id,row.status,JSON.stringify(questionFromRecord(row)));db.prepare('INSERT OR REPLACE INTO question_bank_meta VALUES (1,?,?)').run(result.hash||'',new Date().toISOString());db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
 const approved=()=>db.prepare("SELECT data FROM question_bank WHERE status='aprovada' ORDER BY rowid").all().map(r=>JSON.parse(r.data));
 const get=id=>{const row=db.prepare('SELECT data FROM question_bank WHERE id=?').get(id);return row?JSON.parse(row.data):null;};
 function synchronize(file=masterFile,options){const result=readMaster(file,options);if(db.prepare('SELECT hash FROM question_bank_meta WHERE id=1').get()?.hash!==result.hash)importRecords(result);return result;}
 return {approved,get,importRecords,synchronize};
}
