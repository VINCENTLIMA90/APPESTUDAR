import React,{useEffect,useState} from 'react';
import {ArrowRight,BookOpen,Check,Layers3,LockKeyhole,RefreshCw,ShieldCheck} from 'lucide-react';
import {useApp} from './App';
import {api} from './api';
import {useRemote} from './Learning';
import {LegalLinks} from './Legal';
export function planBenefits(id,t,catalog){return (id==='ccse'?['allCCSE','unlimitedCCSE','explainedQuestions','automaticReview','examStudyPlan']:id==='dele'?['allDELE','readingListeningPractice','officialFullPath','includedCorrections','spanishTutor']:['everythingBoth']).map(key=>t(key,{count:catalog.planLimits?.dele?.corrections??30}));}

export function PlansPage({selectedLesson}){
  const {t,lang,user,requireUser,notify,navigate,loadCatalog,loadAccess,catalog}=useApp();
  const {data,error,reload}=useRemote('/billing',true,user?.id || 'guest');
  const [busy,setBusy]=useState(false),[accepted,setAccepted]=useState(false);
  const returned=new URLSearchParams(window.location.search).get('billing');
  const refresh=async()=>{reload();await Promise.all([loadCatalog(),...(user?[loadAccess()]:[])]);};
  useEffect(()=>{
    if(returned!=='success'||data?.modules.length)return;
    let count=0;
    const timer=setInterval(()=>{reload();loadCatalog().catch(()=>{});if(user)loadAccess().catch(()=>{});if(++count>=12)clearInterval(timer);},5000);
    return()=>clearInterval(timer);
  },[returned,user?.id,data?.modules.length]);
  function checkout(plan){requireUser(async()=>{
    setBusy(true);
    try{const {url}=await api('/billing/checkout',{plan,termsAccepted:accepted,immediateAccess:accepted});window.location.assign(url);}
    catch(error){notify(t(error.message),true);reload();}finally{setBusy(false);}
  });}
  async function portal(){setBusy(true);try{const {url}=await api('/billing/portal',{});window.location.assign(url);}catch(error){notify(t(error.message),true);}finally{setBusy(false);}}
  if(error)return <div className="empty-state"><p>{t('error')}</p><button className="button outline" onClick={reload}>{t('retry')}</button></div>;
  if(!data)return <div className="loading-state"><span className="spinner"/>{t('loading')}</div>;
  const paid=data.modules.length>0;
  const active=data.subscriptions.filter(s=>['active','trialing'].includes(s.status)&&Date.parse(s.paidUntil)>Date.now());
  return <>
    <div className="page-heading"><div><span className="eyebrow">RUMBO · {t('plans')}</span><h1>{t('plansTitle')}</h1><p>{t('freeLessons')}</p></div><span className="large-icon"><Layers3 size={27}/></span></div>
    {selectedLesson&&<section className="lesson-paywall"><LockKeyhole size={28}/><div><span className="eyebrow">{t('lockedLessonTitle')}</span><h2>{selectedLesson.title[lang]}</h2><p>{t('subscription_required')}</p></div></section>}
    {returned==='success'&&!paid&&<p className="source-warning" role="status">{t('subscriptionPending')}</p>}
    {returned==='cancel'&&<p className="info-note" role="status">{t('checkoutCancelled')}</p>}
    <section className="access-summary"><div><span className="eyebrow">{t('currentAccess')}</span><h2>{t(paid?'activeSubscription':'freeAccess')}</h2>{active.map(s=><p key={s.id}>{s.plan==='both'?t('bothModules'):s.plan==='ccse'?'CCSE':'DELE A2'} · {t('accessUntil')} {new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeZone:'Europe/Madrid'}).format(new Date(s.paidUntil))}{s.cancelAtPeriodEnd&&<> · {t('renewalCancelled')}</>}</p>)}{!paid&&<p>{t('freeLessons')}</p>}</div><div className="access-actions">{data.hasCustomer&&<button className="button primary" disabled={busy||!data.checkoutAvailable} onClick={portal}>{t('manageSubscription')}<ArrowRight size={16}/></button>}<button className="text-button" disabled={busy} onClick={()=>refresh().catch(()=>notify(t('error'),true))}><RefreshCw size={15}/>{t('refreshAccess')}</button></div></section>
    {!data.checkoutAvailable&&<div className="payments-notice" role="status"><ShieldCheck size={22}/><p>{t('paymentsSoon')}</p></div>}
    {user&&!user.email_verified_at&&<p className="source-warning">{t('emailVerificationHelp')} <button className="text-button" onClick={()=>navigate('settings')}>{t('verifyEmail')}</button></p>}
    <div className="checkout-consent"><p>{t('legalDraft')}</p><label className="consent"><input type="checkbox" required aria-required="true" checked={accepted} onChange={event=>setAccepted(event.target.checked)}/>{t('checkoutConsent')}</label><LegalLinks/></div>
    <div className="pricing-grid">{data.plans.map(plan=>{
      const included=plan.modules.every(module=>data.modules.includes(module));
      const count=catalog.lessons.filter(lesson=>plan.modules.includes(lesson.module)).length;
      return <section key={plan.id} className={'pricing-card '+(plan.id==='both'?'featured':'')}>
        {plan.id==='both'&&<span className="pricing-ribbon">{t('saveTen')}</span>}
        <span className="large-icon">{plan.id==='both'?<Layers3 size={25}/>:<BookOpen size={25}/>}</span>
        <h2>{plan.id==='both'?t('bothModules'):plan.id==='ccse'?'CCSE':'DELE A2'}</h2>
        <div className="plan-price"><strong>{new Intl.NumberFormat(lang,{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(plan.amount/100)}</strong><span>{t('monthly')}</span></div>
        <p className="price-conditions">{t('vatIncluded')} · {t('cancelAnytime')}</p><ul>{planBenefits(plan.id,t,catalog).map(text=><li key={text}><Check size={16}/>{text}</li>)}</ul>
        <button className={'button full '+(plan.id==='both'?'primary':'outline')} disabled={busy||included||!data.checkoutAvailable||!accepted} onClick={()=>checkout(plan.id)}>{t(included?'activeSubscription':data.checkoutAvailable?'subscribe':'notAvailable')}{!included&&<ArrowRight size={16}/>}</button>
      </section>;
    })}</div>
    <div className="pricing-terms"><p>{t('renewalTerms')}</p><p>{t('aiIncluded')}</p></div>
    <button className="button outline" onClick={()=>navigate('lessons',selectedLesson?.module)}>{t('freeLesson')}<ArrowRight size={16}/></button>
  </>;
}
