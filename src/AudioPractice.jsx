import React,{useState} from 'react';
import {useApp} from './App';
export function AudioPractice({id,transcript}){
 const {t}=useApp(),[missing,setMissing]=useState(false);
 return <div className="audio-question">{!missing&&<audio controls preload="metadata" src={'/audio/'+id+'.mp3'} onError={()=>setMissing(true)} aria-label={t('listen')}/>}<p className="info-note">{t(missing?'audioMissing':'neuralAudio')}</p><details open={missing}><summary>{t('transcript')}</summary><p lang="es" dir="ltr">{transcript}</p></details></div>;
}
