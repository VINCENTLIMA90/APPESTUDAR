import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, Circle, Mic, Save, Sparkles, Square, Trash2 } from 'lucide-react';
import { useApp } from './App';
import { api } from './api';
import { AISettings } from './Settings';

export function SkillPractice({ kind, onBack }) {
  const { t, catalog, ai, notify, loadProgress } = useApp();
  const task = catalog.tasks[kind];
  const [text, setText] = useState(''), [rubric, setRubric] = useState([]), [audio, setAudio] = useState(null), [url, setUrl] = useState(null);
  const [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0), [busy, setBusy] = useState(false), [evaluating, setEvaluating] = useState(false);
  const [submissionId, setSubmissionId] = useState(null), [feedback, setFeedback] = useState(null), [consent, setConsent] = useState(false);
  const recorder = useRef(null), stream = useRef(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); }; }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => { if (!recording) return; const timer = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(timer); }, [recording]);
  useEffect(() => { if (seconds >= 120 && recorder.current?.state === 'recording') recorder.current.stop(); }, [seconds]);
  const dirty = () => { setSubmissionId(null); setFeedback(null); };
  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('unsupported');
      const recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { recordingStream.getTracks().forEach(track => track.stop()); return; }
      stream.current = recordingStream;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported(m));
      const device = new MediaRecorder(recordingStream, mime ? { mimeType: mime } : undefined); recorder.current = device;
      const chunks = [];
      device.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      device.onstop = () => {
        recordingStream.getTracks().forEach(track => track.stop());
        if (!mounted.current) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: device.mimeType });
        if (blob.size > 5900000) { notify(t('too_large'), true); return; }
        setAudio(blob); setUrl(URL.createObjectURL(blob)); dirty();
      };
      device.onerror = () => { recordingStream.getTracks().forEach(track => track.stop()); setRecording(false); notify(t('micError'), true); };
      device.start(1000); setSeconds(0); setRecording(true);
    } catch { stream.current?.getTracks().forEach(track => track.stop()); notify(t('micError'), true); }
  }
  async function saveResponse() {
    if (submissionId) return submissionId;
    setBusy(true);
    try {
      const encoded = audio ? await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(audio); }) : undefined;
      const data = await api('/submissions', { kind, text, audio: encoded, mime: audio?.type, rubric });
      setSubmissionId(data.id); await loadProgress(); notify(t('saved')); return data.id;
    } catch (error) { notify(t(error.message), true); return null; } finally { setBusy(false); }
  }
  async function evaluate() {
    if (!ai.key || !consent) return;
    setEvaluating(true);
    try {
      const id = await saveResponse();
      if (!id) return;
      const result = await api('/submissions/' + id + '/evaluate', { provider: ai.provider, key: ai.key });
      setFeedback(result); await loadProgress();
    } catch (e) { notify(t(e.message), true); } finally { setEvaluating(false); }
  }
  const valid = !!text.trim() || !!audio;
  return <div className="skill-page"><button className="text-button" onClick={onBack}><ChevronLeft size={17} />{t('back')}</button><div className="page-heading"><div><span className="eyebrow">DELE A2</span><h1>{t(kind)}</h1><p>{t('notCertified')}</p></div><span className="tag"><Sparkles size={14} />{t('ai')}</span></div><div className="task-prompt" lang="es" dir="ltr"><h2>{t('practice')}</h2><p>{task.prompt}</p></div>
    {kind === 'speaking' && <section className="recording-card"><span className={'recording-icon ' + (recording ? 'is-recording' : '')}><Mic size={30} /></span><div className="recording-controls"><button className={'button ' + (recording ? 'danger' : 'primary')} disabled={busy || evaluating} onClick={recording ? () => recorder.current.stop() : startRecording}>{recording ? <Square size={15} /> : <Mic size={17} />}{t(recording ? 'stop' : 'record')}</button><span className="recording-time">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')} <small>/ 02:00</small></span></div>{url && <div className="recorded-audio"><audio controls src={url} /><button className="icon-button" disabled={busy || evaluating || recording} aria-label={t('deleteAccount')} onClick={() => { setAudio(null); setUrl(null); dirty(); }}><Trash2 size={18} /></button></div>}</section>}
    <label className="response-label">{kind === 'speaking' ? t('transcriptLabel') : t('writing')}<textarea aria-label={kind === 'speaking' ? t('transcriptLabel') : t('writing')} lang="es" dir="ltr" value={text} onChange={e => { setText(e.target.value); dirty(); }} maxLength={12000} disabled={busy || evaluating} placeholder={t('writeHere')} rows={kind === 'writing' ? 9 : 5} /><span className="word-count" aria-hidden="true">{text.trim() ? text.trim().split(/\s+/u).length : 0} {t('words')}</span></label>
    <details className="model-answer"><summary>{t('modelAnswer')}</summary><p lang="es" dir="ltr" className="preserve-lines">{task.model}</p></details><section className="self-rubric"><h2>{t('selfAssessment')}</h2>{task.rubric.map((item, i) => <label key={i} lang="es" dir="ltr"><input type="checkbox" checked={rubric.includes(i)} disabled={busy || evaluating} onChange={e => { setRubric(e.target.checked ? [...rubric, i] : rubric.filter(v => v !== i)); dirty(); }} />{item}</label>)}</section>
    <div className="skill-save"><button className="button primary" disabled={!valid || busy || evaluating || recording || !!submissionId} onClick={saveResponse}>{submissionId ? <CheckCircle2 size={17} /> : <Save size={17} />}{t(submissionId ? 'saved' : busy ? 'saving' : 'saveAnswer')}</button></div>
    {!ai.key && <AISettings />}
    <section className="ai-evaluation"><div className="settings-heading"><span className="large-icon"><Sparkles size={25} /></span><div><h2>{t('ai')}</h2><p>{t('notCertified')}</p></div></div><label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t('consent')}</label><button className="button primary" disabled={!valid || !consent || !ai.key || busy || evaluating || recording || !!feedback} onClick={evaluate}><Sparkles size={17} className={evaluating ? 'spin' : ''} />{t(evaluating ? 'evaluating' : 'evaluate')}{ai.key && <span className="provider-pill">{catalog.providers.find(p => p.id === ai.provider)?.label}</span>}</button>
    {feedback && <div className="ai-feedback" aria-live="polite"><p>{feedback.summary}</p><div className="feedback-grid">{['strengths', 'improvements'].map(k => <div key={k}><h3>{t(k)}</h3><ul>{feedback[k].map((item, i) => <li key={i}>{item}</li>)}</ul></div>)}</div><h3>{t('modelAnswer')}</h3><p lang="es" dir="ltr" className="preserve-lines corrected-text">{feedback.corrected}</p><strong>{t('recommended')}</strong><p>{feedback.nextStep}</p>{feedback.transcript && kind === 'speaking' && <details><summary>{t('transcript')}</summary><p lang="es" dir="ltr">{feedback.transcript}</p></details>}<small>{feedback.provider} · {feedback.model}</small></div>}
    </section><p className="info-note">{t('privacy')}</p></div>;
}
