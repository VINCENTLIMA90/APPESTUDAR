import React from 'react';
import {ArrowRight,BookOpen,Check,Clock3,Layers3,Mic,RotateCcw,ShieldCheck} from 'lucide-react';
import {useApp} from './App';
import {SpainIllustration} from './components';
import {planBenefits} from './Plans';

// Presentation only: selecting a plan opens registration, never a payment flow.
const offers=[{id:'ccse',amount:15,modules:['ccse']},{id:'dele',amount:15,modules:['dele']},{id:'both',amount:20,modules:['ccse','dele']}];
export function Welcome(){
  const {t,lang,catalog,openAuth}=useApp();
  const count=module=>catalog.lessons.filter(lesson=>lesson.module===module).length;
  const number=value=>new Intl.NumberFormat(lang).format(value);
  return <div className="welcome-page">
    <section className="hero welcome-hero" aria-labelledby="welcome-title">
      <div className="hero-copy"><span className="eyebrow">CCSE · DELE A2</span><h1 id="welcome-title">{t('welcomeTitle')}</h1><p>{t('welcomeIntro')}</p><div className="welcome-actions"><button className="button primary" onClick={()=>openAuth('register')}>{t('register')}<ArrowRight size={18} className="directional"/></button><button className="button outline" onClick={()=>openAuth('login')}>{t('alreadyAccount')}</button></div><p className="welcome-free"><Check size={17}/>{t('freeLessons')}</p></div>
      <SpainIllustration/>
    </section>
    <section className="welcome-section" aria-labelledby="benefits-title"><div className="section-heading"><h2 id="benefits-title">{t('welcomeBenefits')}</h2></div><div className="welcome-benefits">{[[BookOpen,'shortLessons','shortLessonsBody'],[Clock3,'timedPractice','timedPracticeBody'],[RotateCcw,'learnFromErrors','learnFromErrorsBody'],[Mic,'writingSpeakingHelp','writingSpeakingHelpBody']].map(([Icon,title,body])=><article className="welcome-benefit" key={title}><span className="large-icon"><Icon size={26}/></span><h3>{t(title)}</h3><p>{t(body)}</p></article>)}</div></section>
    <section className="welcome-section" aria-labelledby="welcome-prices-title"><div className="section-heading"><div><h2 id="welcome-prices-title">{t('chooseYourPath')}</h2><p>{t('freeLessons')}</p></div></div><p className="info-note">{t('presentationPrices')}</p><div className="pricing-grid">{offers.map(offer=><article className={'pricing-card '+(offer.id==='both'?'featured':'')} key={offer.id}>
      {offer.id==='both'&&<span className="pricing-ribbon">{t('saveTen')}</span>}<span className="large-icon">{offer.id==='both'?<Layers3 size={25}/>:<BookOpen size={25}/>}</span><h3>{offer.id==='both'?t('bothModules'):offer.id==='ccse'?'CCSE':'DELE A2'}</h3><div className="plan-price"><strong>{new Intl.NumberFormat(lang,{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(offer.amount)}</strong><span>{t('monthly')}</span></div><p className="price-conditions">{t('vatIncluded')} · {t('cancelAnytime')}</p><ul>{planBenefits(offer.id,t,catalog).map(text=><li key={text}><Check size={17}/>{text}</li>)}</ul><button className={'button full '+(offer.id==='both'?'primary':'outline')} onClick={()=>openAuth('register')}>{t('register')}<ArrowRight size={17} className="directional"/></button>
    </article>)}</div><p className="info-note">{t('aiIncluded')}</p></section>
    <section className="welcome-section welcome-faq" aria-labelledby="faq-title"><h2 id="faq-title">{t('frequentQuestions')}</h2>{['Who','Free','AI','Official'].map(id=><details key={id}><summary>{t('faq'+id+'Question')}</summary><p>{t('faq'+id+'Answer')}</p></details>)}</section>
    <section className="welcome-closing"><ShieldCheck size={25}/><div><h2>{t('startAtYourPace')}</h2><p>{t('freeLessons')}</p></div><button className="button primary" onClick={()=>openAuth('register')}>{t('register')}<ArrowRight size={18} className="directional"/></button></section>
  </div>;
}
