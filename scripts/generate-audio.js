import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {questions,lessons} from '../server/content.js';
const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/audio');
const dry=process.argv.includes('--dry-run');
const voices=JSON.parse(process.env.TTS_VOICES||'[]');
if(voices.length<2||!voices.some(v=>v.locale==='es-ES')||!voices.some(v=>/^es-(MX|US|AR|CO|CL|PE)$/.test(v.locale))||voices.some(v=>!/^es-[A-Z]{2}$/.test(v.locale)||!/^es-[A-Z]{2}-[A-Za-z]+Neural$/.test(v.name)))throw new Error('TTS_VOICES must include valid Azure neural voices from Spain and Latin America.');
if(!dry&&(process.env.TTS_PROVIDER!=='azure'||!process.env.TTS_API_KEY||!/^[-a-z0-9]+$/.test(process.env.TTS_REGION||'')))throw new Error('Configure TTS_PROVIDER, TTS_API_KEY and TTS_REGION.');
const items=[...questions.filter(q=>q.audio).map(q=>({id:q.id,text:q.audio})),...lessons.filter(l=>l.category==='listening'&&l.activity).map(l=>({id:'lesson-'+l.id,text:l.activity.model}))];
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
if(!dry)await mkdir(output,{recursive:true});
for(const [index,item] of items.entries()){
  const voice=voices[index%voices.length];
  if(dry){console.log(JSON.stringify({id:item.id,voice:voice.name,locale:voice.locale,path:'/audio/'+item.id+'.mp3'}));continue;}
  const response=await fetch('https://'+process.env.TTS_REGION+'.tts.speech.microsoft.com/cognitiveservices/v1',{method:'POST',signal:AbortSignal.timeout(60000),headers:{'Ocp-Apim-Subscription-Key':process.env.TTS_API_KEY,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'Rumbo-audio-generator'},body:`<speak version="1.0" xml:lang="${voice.locale}"><voice name="${voice.name}">${escape(item.text)}</voice></speak>`});
  if(!response.ok)throw new Error('Voice service returned HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<100)throw new Error('Empty audio response');
  await writeFile(path.join(output,item.id+'.mp3'),bytes);console.log('Generated '+item.id+'.mp3');
}
console.log((dry?'Planned ':'Generated ')+items.length+' audio files.');
