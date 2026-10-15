import React,{useState} from 'react';
import {useApp} from './App';
import {api} from './api';
export const legalPages=['terms','privacyPolicy','cancellation'];
export function LegalLinks({onNavigate}={}){const {t,navigate}=useApp();return <nav className="legal-links" aria-label={t('legalInformation')}>{legalPages.map(page=><button type="button" className="text-button" key={page} onClick={()=>{onNavigate?.();navigate(page);}}>{t(page)}</button>)}</nav>;}
export function LegalPage({page}){const {t}=useApp();return <article className="legal-page"><h1>{t(page)}</h1><p className="source-warning">{t('legalDraft')}</p><p>{t(page+'DraftBody')}</p></article>;}
export function AccountAction({action,token}){
 const {t}=useApp(),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 async function submit(event){event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));if(action==='reset'&&values.password!==values.confirm){setError(t('passwordMismatch'));return;}setBusy(true);try{await api('/auth/'+(action==='reset'?'reset-password':'verify-email'),{token,...values});setDone(true);}catch(error){setError(t(error.message));}finally{setBusy(false);}}
 return <section className="settings-card account-action"><h1>{t(action==='reset'?'resetPassword':'verifyEmail')}</h1>{done?<><p role="status">{t(action==='reset'?'passwordResetDone':'emailVerified')}</p><button className="button primary" onClick={()=>{window.history.replaceState({},'',window.location.pathname);window.location.reload();}}>{t('continue')}</button></>:<form onSubmit={submit}>{action==='reset'&&<><label>{t('password')}<input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/></label><label>{t('confirmPassword')}<input name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/></label></>}{error&&<p className="inline-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{t(busy?'saving':action==='reset'?'resetPassword':'verifyEmail')}</button></form>}</section>;
}
