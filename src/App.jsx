import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, CircleHelp, ClipboardCheck, Flame, Globe2, LayoutDashboard, LogIn, LogOut, Menu, MessageCircle, RotateCcw, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { api } from './api';
import { locales, translate } from './i18n';
import { Brand, Modal } from './components';
import { Dashboard, LessonPage, Lessons, ProgressPage, SourcesPage, SettingsPage, AssessmentPage, TestsPage } from './pages';
import { Quiz, QuizResult } from './Quiz';
import { SkillPractice } from './SkillPractice';
import { PlanPage, ReviewPage } from './Learning';
import { TutorPage } from './Tutor';
import { FullExamPage } from './FullExam';
import { PlansPage } from './Plans';

const Context = createContext();
export const useApp = () => useContext(Context);
const emptyProgress = { completed: [], results: [], submissions: [], activeDays: [], streak: 0 };
const navigation = [['dashboard', LayoutDashboard], ['plan',CalendarDays], ['lessons', BookOpen], ['tests', ClipboardCheck], ['reviewHub',RotateCcw], ['tutor',MessageCircle], ['assessment', Sparkles], ['progress', ChartNoAxesCombined], ['sources', ShieldCheck], ['plans', ClipboardCheck]];

export default function App() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('rumbo-language') || 'pt-PT'; } catch { return 'pt-PT'; } });
  const [user, setUser] = useState(null), [catalog, setCatalog] = useState(null), [progress, setProgress] = useState(emptyProgress);
  const [page, setPage] = useState(()=>new URLSearchParams(window.location.search).has('billing')?'plans':'dashboard'), [module, setModule] = useState('ccse'), [lesson, setLesson] = useState(null);
  const [lockedLesson,setLockedLesson]=useState(null);
  const [quiz, setQuiz] = useState(null), [result, setResult] = useState(null), [skill, setSkill] = useState(null);
  const [auth, setAuth] = useState(null), [authNext, setAuthNext] = useState(null), [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState(null), [bootError, setBootError] = useState(false), [ready, setReady] = useState(false);
  const [ai, setAI] = useState({ provider: 'openai', key: '' });
  const [tutorContext,setTutorContext]=useState('');
  const t = key => translate(lang, key);
  const notify = useCallback((message, error = false) => setToast({ message, error, id: Date.now() }), []);
  const loadProgress = useCallback(async () => { const data = await api('/progress'); setProgress(data); return data; }, []);
  const loadCatalog = useCallback(async () => { const data = await api('/catalog'); setCatalog(data); return data; }, []);
  async function boot() {
    setBootError(false);
    try {
      const [c, me] = await Promise.all([api('/catalog'), api('/me')]);
      setCatalog(c); setUser(me.user);
      if (me.user) { setLang(me.user.language); await loadProgress(); }
      setReady(true);
    } catch { setBootError(true); }
  }
  useEffect(() => { boot(); }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('rumbo-language', lang); } catch { /* optional preference storage */ }
  }, [lang]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 6000); return () => clearTimeout(timer); }, [toast]);
  const requireUser = action => {
    if (user) return action();
    setAuthNext(() => action); setAuth('register');
  };
  const navigate = (destination, selectedModule) => {
    if (quiz && !window.confirm(t('abandon'))) return;
    setQuiz(null); setResult(null); setSkill(null); setLesson(null); setLockedLesson(null); setPage(destination); setMobile(false);
    if (selectedModule) setModule(selectedModule);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  async function startQuiz(mode, selectedModule = module) {
    requireUser(async () => {
      try {
        const data = await api('/quizzes', { mode, module: selectedModule });
        setQuiz(data); setResult(null); setPage('tests'); setSkill(null); setLesson(null); setMobile(false);
        window.scrollTo({ top: 0 });
      } catch (error) { notify(t(error.message), true); }
    });
  }
  function openSkill(kind,taskId=kind,existing=null) { requireUser(() => { setSkill({kind,taskId,existing}); setPage('tests'); setQuiz(null); setResult(null); setLesson(null); }); }
  function askTutor(context) { requireUser(()=>{navigate('tutor');setTutorContext(context);}); }
  async function openLesson(selected) {
    try { const {lesson}=await api('/lessons/'+selected.id);setLesson(lesson);setModule(selected.module);setPage('lessons');setQuiz(null);setResult(null);setSkill(null);setMobile(false);window.scrollTo({top:0}); }
    catch(error){if(error.status===402){navigate('plans');setLockedLesson(selected);}else notify(t(error.message),true);}
  }
  async function changeLanguage(value) { setLang(value); if (user) { try { await api('/me', { language: value }, 'PATCH'); } catch (error) { notify(t(error.message), true); } } }
  async function logout() { try { await api('/auth/logout', {}); setUser(null); setProgress(emptyProgress); setAI({ provider: 'openai', key: '' }); navigate('dashboard'); await loadCatalog(); } catch (error) { notify(t(error.message), true); } }
  const context = { lang, t, user, catalog, progress, loadProgress, loadCatalog, notify, navigate, module, setModule, startQuiz, openSkill, openLesson, requireUser, ai, setAI, changeLanguage,askTutor,tutorContext };
  let content;
  if (!ready) content = <div className="loading-state">{bootError ? <><p>{t('error')}</p><button className="button primary" onClick={boot}>{t('retry')}</button></> : <><span className="spinner" />{t('loading')}</>}</div>;
  else if (quiz) content = <Quiz quiz={quiz} onFinish={async data => { setResult(data); setQuiz(null); await loadProgress(); }} onExit={() => navigate('tests')} />;
  else if (result) content = <QuizResult result={result} onBack={() => setResult(null)} />;
  else if (skill) content = <SkillPractice key={skill.taskId} kind={skill.kind} taskId={skill.taskId} existing={skill.existing} onBack={() => setSkill(null)} />;
  else if (lesson) content = <LessonPage key={lesson.id} lesson={lesson} onBack={() => setLesson(null)} />;
  else content = ({ dashboard: <Dashboard />, plan:<PlanPage/>,reviewHub:<ReviewPage/>,tutor:<TutorPage/>,fullExam:<FullExamPage/>,plans:<PlansPage selectedLesson={lockedLesson}/>, lessons: <Lessons />, tests: <TestsPage />, assessment: <AssessmentPage />, progress: <ProgressPage onResult={setResult} />, sources: <SourcesPage />, settings: <SettingsPage /> })[page];
  return <Context.Provider value={context}>
    <a href="#main" className="skip-link">{t('continue')}</a>
    {mobile && <div className="sidebar-overlay" onClick={() => setMobile(false)} />}
    <aside className={'sidebar ' + (mobile ? 'is-open' : '')}>
      <button className="brand-button" onClick={() => navigate('dashboard')} aria-label="Rumbo"><Brand /></button>
      <p className="brand-tagline">{t('tagline')}</p>
      <button className="mobile-close icon-button" onClick={() => setMobile(false)} aria-label={t('close')}><X size={20} /></button>
      <div className="sidebar-label">{t('workspace')}</div>
      <nav aria-label={t('workspace')}>{navigation.map(([id, Icon]) => <button key={id} onClick={() => navigate(id)} className={'nav-item ' + (page === id || (page==='fullExam'&&id==='tests') ? 'active' : '')} aria-current={page === id ? 'page' : undefined}><Icon size={19} strokeWidth={1.7} /><span>{t(id)}</span>{id === 'assessment' && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-note"><span className="note-spark"><Sparkles size={19} /></span><strong>{t('studyPlan')}</strong><p>{t('quote')}</p><div className="note-line" /></div>
      <div className="sidebar-bottom"><button className={'nav-item ' + (page === 'settings' ? 'active' : '')} onClick={() => navigate('settings')}><Settings2 size={19} />{t('settings')}</button>{user ? <button className="user-profile" onClick={logout} title={t('logout')}><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{t('logout')}</small></span><LogOut size={16} /></button> : <button className="button primary full" onClick={() => setAuth('login')}><LogIn size={17} />{t('login')}</button>}</div>
    </aside>
    <div className="app-body">
      <header className="topbar"><div className="topbar-start"><button className="icon-button mobile-menu" aria-label={t('workspace')} onClick={() => setMobile(true)}><Menu size={23} /></button><span className="breadcrumb"><span className="mini-flag" />{t('journey')}</span></div><div className="topbar-actions">{user && <span className="online-indicator"><span />{t('sessionActive')}</span>}<label className="language-picker"><Globe2 size={17} /><select aria-label={t('language')} value={lang} onChange={e => changeLanguage(e.target.value)}>{Object.entries(locales).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><ChevronDown size={13} /></label>{user ? <span className="avatar top-avatar">{user.name.slice(0, 1).toUpperCase()}</span> : <button className="button small outline auth-top" onClick={() => setAuth('register')}>{t('register')}<ArrowRight size={15} /></button>}</div></header>
      <main id="main" className="main-content" tabIndex={-1}>{content}<footer className="footer"><Brand small /><span>{t('ownContent')}</span><span className="footer-heart">hecho con cariño <span>✦</span></span></footer></main>
    </div>
    {auth && <Auth mode={auth} setMode={setAuth} onClose={() => { setAuth(null); setAuthNext(null); }} onSuccess={async data => { setUser(data.user); setLang(data.user.language); await Promise.all([loadProgress(),loadCatalog()]); const next = authNext; setAuth(null); setAuthNext(null); next?.(); }} />}
    {toast && <div className={'toast ' + (toast.error ? 'toast-error' : '')} role={toast.error ? 'alert' : 'status'}>{toast.error ? <CircleHelp size={19} /> : <Check size={19} />}<span>{toast.message}</span><button className="icon-button" onClick={() => setToast(null)} aria-label={t('close')}><X size={16} /></button></div>}
  </Context.Provider>;
}

function Auth({ mode, setMode, onClose, onSuccess }) {
  const { t, lang } = useApp();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const data = Object.fromEntries(new FormData(event.target));
    try { await onSuccess(await api('/auth/' + mode, { ...data, language: lang })); } catch (error) { setError(t(error.message)); } finally { setBusy(false); }
  }
  return <Modal onClose={onClose} title={t(mode)} t={t}><Brand /><h2>{t(mode)}</h2><p className="muted">{t('authBody')}</p><form onSubmit={submit}>
    {mode === 'register' && <label>{t('name')}<input name="name" autoComplete="name" required maxLength={70} /></label>}
    <label>{t('email')}<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label>{t('password')}<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 10 : 1} maxLength={128} required placeholder={mode === 'register' ? t('passwordHint') : ''} /></label>
    {error && <p className="inline-error" role="alert">{error}</p>}<button className="button primary full" disabled={busy}>{t(busy ? 'loading' : mode)}</button>
  </form><button className="text-button auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{t(mode === 'login' ? 'register' : 'login')}<ArrowRight size={16} /></button></Modal>;
}
