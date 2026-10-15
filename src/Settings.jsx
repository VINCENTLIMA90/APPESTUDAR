import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, Download, ExternalLink, Globe2, KeyRound, RefreshCw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from './App';
import { locales } from './i18n';
import { api } from './api';

export function AISettings() {
  const { t, ai, setAI, catalog } = useApp();
  const [key, setKey] = useState('');
  const [provider, setProvider] = useState(ai.provider);
  return <section className="settings-card"><div className="settings-heading"><span className="large-icon"><Sparkles size={24} /></span><div><h2>{t('ai')}</h2><p>{t('aiDesc')}</p></div></div><form onSubmit={e => { e.preventDefault(); setAI({ provider, key }); setKey(''); }}><label>API<select value={provider} onChange={e => setProvider(e.target.value)}>{catalog.providers.map(p => <option value={p.id} key={p.id}>{p.label} · {p.model}</option>)}</select></label><label>{t('apiKey')}<input type="password" autoComplete="off" spellCheck="false" value={key} onChange={e => setKey(e.target.value)} minLength={10} maxLength={1024} required placeholder="••••••••••••••••" /></label><div className="settings-actions"><button className="button primary" type="submit"><KeyRound size={16} />{t('save')}</button>{ai.key && <><span className="status success"><CheckCircle2 size={15} />{catalog.providers.find(p => p.id === ai.provider)?.label} · {t('connected')}</span><button className="text-button" type="button" onClick={() => { setAI({ provider, key: '' }); setKey(''); }}>{t('disconnect')}</button></>}</div></form></section>;
}
export function SettingsPage() {
  const { t, lang, user, changeLanguage, requireUser, notify } = useApp();
  const [deleting, setDeleting] = useState(false);
  async function removeAccount() {
    if (!window.confirm(t('deleteConfirm'))) return;
    setDeleting(true);
    try { await api('/me', {}, 'DELETE'); window.location.reload(); } catch (e) { notify(t(e.message), true); setDeleting(false); }
  }
  return <><div className="page-heading"><div><h1>{t('settings')}</h1><p>{t('authBody')}</p></div></div><section className="settings-card"><div className="settings-heading"><span className="large-icon"><Globe2 size={24} /></span><div><h2>{t('language')}</h2><p>{t('spanishContent')}</p></div></div><select aria-label={t('language')} value={lang} onChange={e => changeLanguage(e.target.value)}>{Object.entries(locales).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></section><AISettings /><section className="settings-card"><div className="settings-heading"><span className="large-icon"><ShieldCheck size={24} /></span><div><h2>{user ? user.name : t('register')}</h2>{user && <p>{user.email}</p>}</div></div><p className="muted">{t('privacy')}</p><div className="settings-actions">{user ? <><a className="button outline" href="/api/export" download><Download size={17} />{t('export')}</a><button className="button danger" disabled={deleting} onClick={removeAccount}><Trash2 size={16} />{t('deleteAccount')}</button></> : <button className="button primary" onClick={() => requireUser(() => {})}>{t('register')}</button>}</div></section></>;
}
export function SourcesPage() {
  const { t, lang, requireUser, notify } = useApp();
  const [sources, setSources] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  async function load() { try { setSources((await api('/sources')).sources); setError(false); } catch { setError(true); } }
  useEffect(() => { load(); }, []);
  function check() { requireUser(async () => { setBusy(true); try { await api('/sources/check', {}); await load(); } catch (e) { notify(t(e.message), true); } finally { setBusy(false); } }); }
  return <><div className="page-heading"><div><h1>{t('sources')}</h1><p>Instituto Cervantes</p></div><button className="button outline" onClick={check} disabled={busy}><RefreshCw size={16} className={busy ? 'spin' : ''} />{t('checkSources')}</button></div><div className="source-explainer"><ShieldCheck size={26} /><p>{t('sourceBody')}</p></div>{error ? <p className="inline-error">{t('error')}</p> : !sources ? <p>{t('loading')}</p> : <div className="source-list">{sources.map(source => <section className="source-card" key={source.id}><div className="source-heading"><h2>{source.title}</h2><span className={'status ' + (source.error || !source.verified_at || source.changed_at ? 'warning' : 'success')}>{source.error || !source.verified_at ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{t(source.changed_at ? 'sourceChanged' : source.error || !source.verified_at ? 'unverified' : 'verified')}</span></div><p lang="es" dir="ltr">{source.description}</p>{source.error && <p className="source-warning">{t('sourceBlocked')} <code>{source.error}</code></p>}{source.checked_at && <small className="muted">{new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(source.checked_at))}</small>}{source.materials?.length > 0 && <div className="material-links" lang="es" dir="ltr">{source.materials.map(material => <a href={material.url} key={material.url} target="_blank" rel="noopener noreferrer"><Download size={14} /><span>{material.title}</span><ExternalLink size={12} /></a>)}</div>}<a className="button outline" href={source.url} target="_blank" rel="noopener noreferrer">{t('openOfficial')}<ArrowUpRight size={16} /></a></section>)}</div>}<p className="info-note">{t('ownContent')}</p></>;
}
