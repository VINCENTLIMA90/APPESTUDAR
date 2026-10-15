import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {readMaster,encodeCSV,masterFile} from '../server/question-bank.js';
try{const file=process.argv[2]||masterFile,output=process.argv[3]||'questions-drafts.csv';if(path.resolve(output)===path.resolve(file))throw new Error('Choose a separate output file');const {records}=readMaster(file);writeFileSync(output,encodeCSV(records.filter(r=>r.status==='rascunho').map(r=>({...r,correct:r.correct+1}))),'utf8');console.log('Draft review export: '+output);}catch(error){console.error(error.message);process.exitCode=1;}
