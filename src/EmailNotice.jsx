import React,{useEffect,useState} from 'react';
import {useApp} from './App';
import {api} from './api';
export function useResendCooldown(until=null){
 const[end,setEnd]=useState(()=>Math.max(0,Date.parse(until)||0)),[now,setNow]=useState(Date.now);
 useEffect(()=>{if(until)setEnd(Math.max(0,Date.parse(until)||0));},[until]);
 const seconds=Math.max(0,Math.ceil((end-now)/1000));
 useEffect(()=>{if(!seconds)return;const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[end,seconds>0]);
 return{seconds,start:()=>{const at=Date.now();setNow(at);setEnd(at+60000);}};
}
export function VerificationNotice({trial=false}){
 const{t,user,access,loadAccess,notify}=useApp(),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),cooldown=useResendCooldown(access?.email?.verificationRetryAt);
 if(!user||user.email_verified_at)return null;
 async function resend(){setBusy(true);try{await api('/auth/request-verification',{});cooldown.start();setSent(true);await loadAccess();}catch(error){notify(t(error.message),true);}finally{setBusy(false);}}
 return <section className="verification-notice" role="status"><h3>{t(trial?'trial_email_required':'verifyEmail')}</h3><p>{t(access?.email?.verificationFailed?'emailDeliveryFailed':sent||cooldown.seconds?'emailSentNotice':'emailVerificationHelp')}</p><button className="button outline" disabled={busy||cooldown.seconds>0} onClick={resend}>{t(cooldown.seconds?'resendCountdown':'resend',{count:cooldown.seconds})}</button>{!access?.emailAvailable&&<p>{t('emailUnavailable')}</p>}</section>;
}
