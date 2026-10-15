import React,{useState} from 'react';
import {BookOpen,Check,ExternalLink} from 'lucide-react';
import {useApp} from './App';
import {api} from './api';
import {manual} from './config/exam-requirements';
export function OfficialManualStep(){
 const{t,progress,loadProgress,notify}=useApp(),[busy,setBusy]=useState(false),done=progress.learningSteps?.some(s=>s.step_id===manual.id);
 async function complete(){setBusy(true);try{await api('/learning-steps/'+manual.id,{});await loadProgress();}catch(error){notify(t(error.message),true);}finally{setBusy(false);}}
 return <section className="manual-step"><BookOpen size={27}/><div><h2>{t('readOfficialManual')}</h2><p>{t('manualExternalNote',{year:manual.year})}</p><a className="text-button" href={manual.url} target="_blank" rel="noopener noreferrer">{t('openManualPDF')}<ExternalLink size={16}/></a> · <a className="text-button" href={manual.source} target="_blank" rel="noopener noreferrer">{t('sources')}</a></div><button className="button outline" disabled={busy||done} onClick={complete}>{done&&<Check size={17}/>} {t(done?'done':'complete')}</button></section>;
}
export function FactMastery(){const{t,lang,progress}=useApp();if(!progress.facts?.length)return null;const number=value=>new Intl.NumberFormat(lang).format(value);return <section className="fact-mastery"><h2>{t('factMastery')}</h2><p>{t('masteryRule')}</p><div className="mastery-grid">{progress.facts.map(row=><article className="mastery-card" key={row.category}><strong>{t(row.category)}</strong><span>{number(row.mastered)} / {number(row.total)}</span><p>{t('masteredCount',{mastered:number(row.mastered),total:number(row.total)})}</p></article>)}</div></section>;}
