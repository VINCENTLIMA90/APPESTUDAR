import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {readMaster,installQuestionBank,masterFile} from '../server/question-bank.js';
import {lessons} from '../server/content.js';
try{
 const file=process.argv.slice(2).find(argument=>!argument.startsWith('--'))||masterFile,result=readMaster(file,{lessons});
 if(process.argv.includes('--check')){console.log(`Valid: ${result.records.length} questions; no database changes.`);}else{
 const directory=process.env.DATA_DIR||path.resolve('.data');mkdirSync(directory,{recursive:true});const db=new DatabaseSync(path.join(directory,'rumbo.sqlite'));try{installQuestionBank(db).importRecords(result);console.log(`Imported ${result.records.length} variants (${result.records.filter(r=>r.status==='aprovada').length} approved).`);}finally{db.close();}}
}catch(error){console.error(error.message);process.exitCode=1;}
