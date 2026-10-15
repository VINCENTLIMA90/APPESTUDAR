import React,{useState} from 'react';
import {ArrowRight,BookOpen,Check,Clock3,Layers3,Mic,RotateCcw,ShieldCheck,ClipboardCheck,Target} from 'lucide-react';
import {useApp} from './App';
import {SpainIllustration} from './components';
import {planBenefits} from './Plans';
import {spanishOfficialCountries,requirementsSource,readExamAnswer,saveExamAnswer} from './config/exam-requirements';

// Presentation only: selecting a plan opens registration, never a payment flow.
const offers=[{id:'ccse',amount:15,modules:['ccse']},{id:'dele',amount:15,modules:['dele']},{id:'both',amount:20,modules:['ccse','dele']}];
export function Welcome(){
  const {t,lang,catalog,openAuth}=useApp();
  const [answer,setAnswer]=useState(readExamAnswer);
  const recommended=answer==='yes'?'ccse':answer==='no'?'both':null;
  function choose(value){setAnswer(value);saveExamAnswer(value);}
  return <div className="welcome-page">
    <section className="hero welcome-hero" aria-labelledby="welcome-title">
      <div className="hero-copy"><span className="eyebrow">CCSE · DELE A2</span><h1 id="welcome-title">{t('welcomeTitle')}</h1><p>{t('welcomeIntro')}</p><div className="welcome-actions"><button className="button primary" onClick={()=>openAuth('register')}>{t('register')}<ArrowRight size={18} className="directional"/></button><button className="button outline" onClick={()=>openAuth('login')}>{t('alreadyAccount')}</button></div><p className="welcome-free">{t('freeOfferLead')}</p><ul className="free-offer-list">{[[Target,'freeAssessment'],[ClipboardCheck,'freeCCSESimulation'],[Clock3,'freeDELETest'],[BookOpen,'freeModuleLessons']].map(([Icon,key])=><li key={key}><Icon size={18}/>{t(key)}</li>)}</ul></div>
      <SpainIllustration/>
    </section>
    <section className="exam-requirements welcome-section" aria-labelledby="requirements-title"><h2 id="requirements-title">{t('whichExams')}</h2><p id="requirements-question">{t('nationalityQuestion')}</p><div className="requirements-options" role="group" aria-labelledby="requirements-question">{['yes','no','unsure'].map(value=><button className={'button outline '+(answer===value?'chosen':'')} key={value} aria-pressed={answer===value} onClick={()=>choose(value)}>{t(value==='unsure'?'notSure':value)}</button>)}</div>{answer&&<div className="requirements-result" role="status">{answer==='unsure'?<details open><summary>{t('spanishCountries')}</summary><ul>{spanishOfficialCountries.map(code=><li key={code}>{new Intl.DisplayNames(lang,{type:'region'}).of(code)}</li>)}</ul></details>:<h3>{t(answer==='yes'?'needCCSE':'needBothExams')}</h3>}<p>{t('confirmRequirements')} <a href={requirementsSource} target="_blank" rel="noopener noreferrer">{t('openOfficial')} ↗</a></p></div>}</section>
    <section className="welcome-section" aria-labelledby="benefits-title"><div className="section-heading"><h2 id="benefits-title">{t('welcomeBenefits')}</h2></div><div className="welcome-benefits">{[[BookOpen,'shortLessons','shortLessonsBody'],[Clock3,'timedPractice','timedPracticeBody'],[RotateCcw,'learnFromErrors','learnFromErrorsBody'],[Mic,'writingSpeakingHelp','writingSpeakingHelpBody']].map(([Icon,title,body])=><article className="welcome-benefit" key={title}><span className="large-icon"><Icon size={26}/></span><h3>{t(title)}</h3><p>{t(body)}</p></article>)}</div></section>
    <section className="welcome-section" aria-labelledby="welcome-prices-title"><div className="section-heading"><div><h2 id="welcome-prices-title">{t('chooseYourPath')}</h2><p>{t('freeLessons')}</p></div></div><p className="info-note">{t('presentationPrices')}</p><div className="pricing-grid">{offers.map(offer=><article className={'pricing-card '+(offer.id===(recommended||'both')?'featured':'')} key={offer.id}>
      {recommended===offer.id&&<p className="recommendation-tag">{t('recommendedForYou')}</p>}{offer.id==='both'&&<span className="pricing-ribbon">{t('saveTen')}</span>}<span className="large-icon">{offer.id==='both'?<Layers3 size={25}/>:<BookOpen size={25}/>}</span><h3>{offer.id==='both'?t('bothModules'):offer.id==='ccse'?'CCSE':'DELE A2'}</h3><div className="plan-price"><strong>{new Intl.NumberFormat(lang,{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(offer.amount)}</strong><span>{t('monthly')}</span></div><p className="price-conditions">{t('vatIncluded')} · {t('cancelAnytime')}</p><ul>{planBenefits(offer.id,t,catalog).map(text=><li key={text}><Check size={17}/>{text}</li>)}</ul><button className={'button full '+(offer.id===(recommended||'both')?'primary':'outline')} onClick={()=>openAuth('register')}>{t('register')}<ArrowRight size={17} className="directional"/></button>
    </article>)}</div><p className="info-note">{t('aiIncluded')}</p></section>
    <section className="welcome-section welcome-faq" aria-labelledby="faq-title"><h2 id="faq-title">{t('frequentQuestions')}</h2>{['Who','Free','AI','Official'].map(id=><details key={id}><summary>{t('faq'+id+'Question')}</summary><p>{t('faq'+id+'Answer')}</p></details>)}</section>
    <section className="welcome-closing"><ShieldCheck size={25}/><div><h2>{t('startAtYourPace')}</h2><p>{t('freeLessons')}</p></div><button className="button primary" onClick={()=>openAuth('register')}>{t('register')}<ArrowRight size={18} className="directional"/></button></section>
  </div>;
}
