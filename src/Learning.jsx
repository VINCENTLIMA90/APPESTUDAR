import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Check, Clock3, Layers3, RotateCcw, Sparkles, Target, Trophy } from 'lucide-react';
import { useApp } from './App';
import { api } from './api';
import { ProgressBar } from './components';

export function useRemote(path, enabled = true, revision = '') {
  const [data,setData]=useState(null),[error,setError]=useState(false),[version,setVersion]=useState(0);
  useEffect(()=>{let active=true; if(!enabled){setData(null);return;} setError(false); api(path).then(v=>{if(active)setData(v);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[path,enabled,version,revision]);
  return {data,error,reload:()=>setVersion(v=>v+1)};
}
export function LoginGate() { const {t,requireUser}=useApp(); return <div className="empty-state"><Sparkles size={33}/><p>{t('authBody')}</p><button className="button primary" onClick={()=>requireUser(()=>{})}>{t('register')}</button></div>; }
const formatDate=(date,lang)=>new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeZone:'Europe/Madrid'}).format(new Date(date));
const madridDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function ExamCountdown(){
  const {user,t,lang,navigate}=useApp();
  const {data,error,reload}=useRemote('/plan',!!user);
  const [today,setToday]=useState(madridDay);
  useEffect(()=>{
    const update=()=>setToday(madridDay());
    const timer=setInterval(update,60000);
    document.addEventListener('visibilitychange',update);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[]);
  if(!user)return null;
  if(error)return <section className="exam-countdown"><CalendarDays size={25}/><p>{t('examDateLoadError')}</p><button className="text-button" onClick={reload}>{t('retry')}</button></section>;
  if(!data)return <section className="exam-countdown" aria-busy="true"><CalendarDays size={25}/><p>{t('loading')}</p></section>;
  const target=data.settings.target_date;
  // Compare calendar days, not elapsed hours, across Madrid's DST changes.
  const days=target?Math.round((Date.parse(target+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000):null;
  const key=days===null?'setExamDate':days<0?'examDatePast':days===0?'examToday':days===1?'examCountdownOne':'examCountdown';
  return <section className="exam-countdown" aria-labelledby="exam-countdown-title"><span className="large-icon"><CalendarDays size={25}/></span><div><h2 id="exam-countdown-title">{t(key,{count:new Intl.NumberFormat(lang).format(days)})}</h2><p>{target?t('examDateSummary',{date:formatDate(target+'T12:00:00Z',lang)}):t('examDateHelp')}</p></div><button className="button outline" onClick={()=>navigate('plan')}>{t(target?'editExamDate':'setExamDate')}<ArrowRight size={16} className="directional"/></button></section>;
}

export function PlanSummary() {
  const {user,t,lang,progress,navigate,catalog,openLesson}=useApp();
  const {data}=useRemote('/plan',!!user,[progress.results.length,progress.completed.length,progress.submissions.length].join('-'));
  if(!data)return null;
  const lesson=catalog.lessons.find(l=>l.id===data.recommendation.lessonId);
  return <section className="daily-path"><div className="daily-path-icon"><CalendarDays size={25}/></div><div><span className="eyebrow">{t('todayPlan')}</span><h3>{t(data.recommendation.category)}</h3><p>{t('forecast')}: {formatDate(data.estimate.from,lang)} – {formatDate(data.estimate.to,lang)}</p></div><div className="daily-path-actions">{lesson&&<button className="button primary" onClick={()=>openLesson(lesson)}>{t('continue')}<ArrowRight size={15}/></button>}<button className="text-button" onClick={()=>navigate('plan')}>{t('plan')}<ArrowRight size={14}/></button></div></section>;
}
export function PlanPage() {
  const {user,t,lang,notify,navigate,catalog,openLesson}=useApp();
  const {data,error,reload}=useRemote('/plan',!!user);
  const [form,setForm]=useState(null),[busy,setBusy]=useState(false);
  useEffect(()=>{if(data)setForm(data.settings);},[data]);
  if(!user)return <LoginGate/>;
  if(error)return <div className="empty-state"><p>{t('error')}</p><button className="button outline" onClick={reload}>{t('retry')}</button></div>;
  if(!data||!form)return <p>{t('loading')}</p>;
  const {estimate,recommendation}=data;
  const lesson=catalog.lessons.find(l=>l.id===recommendation.lessonId);
  const set=(name,value)=>setForm(f=>({...f,[name]:value}));
  async function save(e){e.preventDefault();setBusy(true);try{await api('/plan',{goal:form.goal,sessions_week:Number(form.sessions_week),session_minutes:Number(form.session_minutes),target_date:form.target_date||null},'PUT');reload();notify(t('planSaved'));}catch(e){notify(t(e.message),true);}finally{setBusy(false);}}
  return <><div className="page-heading"><div><h1>{t('plan')}</h1><p>{t('planBody')}</p></div><CalendarDays className="green-text" size={28}/></div><div className="plan-layout"><section className="settings-card"><h2>{t('goal')}</h2><form onSubmit={save} className="plan-form"><label>{t('goal')}<select aria-label={t('goal')} value={form.goal} onChange={e=>set('goal',e.target.value)}><option value="both">{t('both')}</option><option value="ccse">CCSE</option><option value="dele">DELE A2</option></select></label><div className="form-pair"><label>{t('sessionsWeek')}<select aria-label={t('sessionsWeek')} value={form.sessions_week} onChange={e=>set('sessions_week',Number(e.target.value))}>{[1,2,3,4,5,6,7].map(n=><option value={n} key={n}>{n}</option>)}</select></label><label>{t('sessionMinutes')}<select aria-label={t('sessionMinutes')} value={form.session_minutes} onChange={e=>set('session_minutes',Number(e.target.value))}>{[15,20,30,45,60,90].map(n=><option value={n} key={n}>{n} {t('minutes')}</option>)}</select></label></div><label>{t('examDateOptional')}<input type="date" aria-label={t('examDateOptional')} aria-describedby="exam-date-help" min={madridDay()} value={form.target_date||''} onChange={e=>set('target_date',e.target.value)}/><span id="exam-date-help" className="field-help">{t('examDateHelp')}</span></label><button className="button primary" disabled={busy}>{t(busy?'saving':'save')}</button></form></section><section className="forecast-card"><span className="forecast-icon"><Target size={29}/></span><span className="eyebrow">{t('forecast')}</span><h2>{estimate.weeks}–{estimate.upperWeeks} <small>{t('weeks')}</small></h2><p className="forecast-dates">{formatDate(estimate.from,lang)}<br/>— {formatDate(estimate.to,lang)}</p><div className="forecast-details"><span>{estimate.weeklyHours.toLocaleString(lang,{maximumFractionDigits:1})} {t('weeklyHours')}</span><span>{t('forecastMethod')}: {estimate.estimatedHours}</span></div>{estimate.provisional&&<p className="source-warning">{t('provisionalPlan')}</p>}{estimate.targetTooSoon&&<p className="source-warning">{t('targetTooSoon')}</p>}</section></div><p className="info-note">{t('estimateNote')}</p><div className="official-calendar">{Object.entries(data.officialCalendar).map(([id,url])=><a className="text-button" key={id} href={url} target="_blank" rel="noopener noreferrer">{id==='ccse'?'CCSE':'DELE A2'} · {t('sources')}<ArrowRight size={14}/></a>)}</div><section className="weekly-plan"><h2>{t('week')}</h2><div className="schedule-grid">{Array.from({length:data.settings.sessions_week},(_,i)=>{const date=new Date('2026-10-12T12:00:00Z');date.setUTCDate(date.getUTCDate()+Math.floor(i*7/data.settings.sessions_week));return <div key={i}><span className="tag">{new Intl.DateTimeFormat(lang,{weekday:'long',timeZone:'Europe/Madrid'}).format(date)}</span><strong>{data.settings.goal==='both'?(data.settings.sessions_week===1?'CCSE + DELE A2':i%2?'DELE A2':'CCSE'):data.settings.goal==='ccse'?'CCSE':'DELE A2'}</strong><span>{data.settings.session_minutes} {t('minutes')}</span><small>{t('lessons')} + {t('reviewHub')}</small></div>;})}</div></section><section className="daily-path"><div className="daily-path-icon"><Sparkles size={25}/></div><div><span className="eyebrow">{t('focusTopic')}</span><h3>{t(recommendation.category)}</h3><p>{lesson?.title[lang]||t('reviewHub')}</p></div><button className="button primary" onClick={()=>lesson?openLesson(lesson):navigate('reviewHub')}>{t('start')}<ArrowRight size={15}/></button></section></>;
}
export function SkillsMap({compact=false}) {
  const {t,progress}=useApp(); const skills=progress.skills||[];
  return <section className={'skills-map '+(compact?'compact':'')}><div className="section-heading"><h2>{t('competencies')}</h2><span className="tag">{t('notCertified')}</span></div><div className="competency-grid">{skills.map(s=><div className="competency-card" key={s.id}><div><strong>{t(s.id)}</strong>{s.percent!==null?<span className="competency-percent">{s.percent}%</span>:<Sparkles size={17}/>}</div>{s.percent!==null?<><ProgressBar value={s.percent}/><small>{s.count} {t('questions').toLowerCase()}{s.evidence==='limited'?' · '+t('evidenceLimited'):''}</small>{s.trend!==null&&<span className={'trend '+(s.trend>=0?'up':'down')}>{s.trend>0?'+':''}{s.trend}%</span>}</>:<><p>{t(s.evidence)}</p><small>{t('noAIScore')}</small></>}</div>)}</div></section>;
}
export function Milestones(){const{t,progress}=useApp();return <section className="milestones"><h2>{t('achievements')}</h2><div>{['firstLesson','firstTest','sevenDays','tenReviews','fourSkills'].map(id=><span key={id} className={'milestone '+(progress.badges?.includes(id)?'earned':'')}><Trophy size={20}/>{t(id)}{progress.badges?.includes(id)&&<Check size={14}/>}</span>)}</div></section>;}
export function ReviewPage(){
 const{t,user,lang,notify,loadProgress}=useApp();const[kind,setKind]=useState('vocabulary'),[module,setModule]=useState(''),[index,setIndex]=useState(0),[revealed,setRevealed]=useState(false),[busy,setBusy]=useState(false);
 const{data,error,reload}=useRemote('/review?'+new URLSearchParams({...kind?{kind}:{},...module?{module}:{}}),!!user);
 useEffect(()=>{setIndex(0);setRevealed(false);},[data]);
 if(!user)return <LoginGate/>;
 const card=data?.cards[index];
 async function rate(rating){setBusy(true);try{const state=await api('/review/'+card.id+'/rate',{rating});setIndex(i=>i+1);setRevealed(false);notify(t('nextReview')+': '+new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(state.due_at)));await loadProgress();}catch(e){notify(t(e.message),true);}finally{setBusy(false);}}
 return <><div className="page-heading"><div><h1>{t('reviewHub')}</h1><p>{t('reviewSelfNote')}</p></div><RotateCcw size={27} className="green-text"/></div><div className="review-filters"><div className="module-tabs">{['vocabulary','question',''].map(v=><button key={v} className={kind===v?'selected':''} onClick={()=>setKind(v)}>{t(v==='question'?'questions':v||'all')}</button>)}</div><label>{t('modules')}<select value={module} onChange={e=>setModule(e.target.value)}><option value="">{t('all')}</option><option value="ccse">CCSE</option><option value="dele">DELE A2</option></select></label></div>{error?<p className="inline-error">{t('error')}</p>:!data?<p>{t('loading')}</p>:<><div className="review-counts"><span><strong>{data.dueCount}</strong>{t('reviewDue')}</span><span><strong>{data.newCount}</strong>{t('newCards')}</span><span>{Math.min(index+1,data.cards.length)} / {data.cards.length}</span></div>{card?<section className={'flashcard '+(revealed?'flipped':'')}><span className="eyebrow">{card.module==='ccse'?'CCSE':'DELE A2'} · {t(card.kind==='question'?'questions':'vocabulary')}</span><h2 lang="es" dir="ltr">{card.front}</h2>{revealed?<><div className="flashcard-answer" lang="es" dir="ltr"><h3>{card.back}</h3><p>{card.example}</p></div><div className="rating-buttons">{['again','hard','good','easy'].map(r=><button className={'button '+r} disabled={busy} key={r} onClick={()=>rate(r)}>{t(r)}</button>)}</div></>:<button className="button primary" onClick={()=>setRevealed(true)}>{t('revealCard')}<ArrowRight size={16}/></button>}</section>:<div className="empty-state"><Check size={35}/><p>{t('reviewDone')}</p>{data.nextDue&&<small>{t('nextReview')}: {formatDate(data.nextDue,lang)}</small>}<button className="button outline" onClick={reload}>{t('continue')}</button></div>}</>}</>;
}
