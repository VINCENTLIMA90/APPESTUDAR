import React from 'react';
import {LockKeyhole,ArrowRight,Sparkles} from 'lucide-react';
import {useApp} from './App';
export function LockedBadge(){const {t}=useApp();return <span className="locked-badge"><LockKeyhole size={15}/>{t('availableInPlan')}</span>;}
export function LockedFeature({title}){const {t,navigate}=useApp();return <section className="locked-feature"><LockKeyhole size={27}/><div>{title&&<h2>{title}</h2>}<p>{t('availableInPlan')}</p></div><button className="button outline" onClick={()=>navigate('plans')}>{t('viewPlans')}<ArrowRight size={16}/></button></section>;}
export function AIUsage({module='dele'}){
 const {t,lang,access}=useApp(),state=access?.ai?.[module];
 if(!state)return null;
 return <section className="ai-usage"><Sparkles size={23}/><div><h3>{t('aiIncluded')}</h3>{!state.available?<p role="status">{t('ai_unavailable')}</p>:<><p>{t('correctionsLeft',{count:new Intl.NumberFormat(lang).format(state.corrections.remaining)})}</p><p>{t('tutorLeft',{count:new Intl.NumberFormat(lang).format(state.tutor.remaining)})}</p></>}{state.renewAt&&<p>{t('aiRenews',{date:new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeZone:'Europe/Madrid'}).format(new Date(state.renewAt))})}</p>}</div></section>;
}
