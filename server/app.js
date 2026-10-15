import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { lessons, tasks, languages, officialSources } from './content.js';
import { evaluateAI } from './ai.js';
import { extractMaterials, materialFingerprint } from './sources.js';
import { installLearning, skillSummary, studyDate } from './learning.js';
import { installExams, examTasks, model } from './exam.js';
import { installTutor } from './tutor.js';
import { installBilling } from './billing.js';
import {installAccess} from './access.js';
import {installAccounts} from './accounts.js';
import {installQuestionBank} from './question-bank.js';
import {installQuizzes} from './quizzes.js';
import {installGoogle} from './google.js';
const allTasks = Object.fromEntries(Object.entries({ ...tasks, ...examTasks }).map(([id, task]) => [id, { ...task, kind: task.kind || id }]));

export function createApp({ dataDir = path.resolve('.data'), secure = process.env.NODE_ENV === 'production', ai = evaluateAI, tutor, sourceFetch = fetch, billingConfig, billingFetch, aiConfig, emailConfig, emailSend, logger, clock, googleConfig, googleFetch } = {}) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'rumbo.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, salt TEXT NOT NULL, language TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS completions (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id TEXT NOT NULL, completed_at TEXT NOT NULL, PRIMARY KEY(user_id, lesson_id));
    CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, module TEXT NOT NULL, mode TEXT NOT NULL, question_ids TEXT NOT NULL, created_at TEXT NOT NULL, result TEXT);
    CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, text TEXT NOT NULL, audio BLOB, mime TEXT, rubric TEXT NOT NULL, feedback TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, checked_at TEXT, verified_at TEXT, fingerprint TEXT, changed_at TEXT, error TEXT, materials TEXT NOT NULL DEFAULT '[]');`);
  if (!db.prepare('PRAGMA table_info(sources)').all().some(c => c.name === 'materials')) db.exec("ALTER TABLE sources ADD COLUMN materials TEXT NOT NULL DEFAULT '[]'; UPDATE sources SET fingerprint=NULL, verified_at=NULL, changed_at=NULL");
  for (const column of ['task_id', 'exam_id']) if (!db.prepare('PRAGMA table_info(submissions)').all().some(c => c.name === column)) db.exec(`ALTER TABLE submissions ADD COLUMN ${column} TEXT`);
  for (const source of officialSources) db.prepare('INSERT OR IGNORE INTO sources(id) VALUES (?)').run(source.id);
  const bank=installQuestionBank(db);bank.synchronize(undefined,{lessons});
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy',1);
  const billing = installBilling(app,db,{requireUser,...(billingConfig?{config:billingConfig}:{}),...(billingFetch?{requester:billingFetch}:{})});
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      // Browsers cannot send these requests cross-site without a preflight (no CORS is enabled).
      if (!req.is('application/json') || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'request_rejected' });
      const origin = req.get('origin');
      if (origin) {
        try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'request_rejected' }); } catch { return res.status(403).json({ error: 'request_rejected' }); }
      }
    }
    next();
  });
  app.use(express.json({ limit: '9mb' }));
  const attempts = new Map();
  function limit(req, res, next) {
    const key = req.ip;
    const bucket = attempts.get(key) || { count: 0, until: Date.now() + 15 * 60000 };
    if (bucket.until < Date.now()) { bucket.count = 0; bucket.until = Date.now() + 15 * 60000; }
    bucket.count++;
    attempts.set(key, bucket);
    if (bucket.count > 30) return res.status(429).json({ error: 'rate_limit' });
    next();
  }
  const accounts=installAccounts(app,db,{secure,limit,languages,...(emailConfig?{config:emailConfig}:{}),...(emailSend?{send:emailSend}:{}),...(logger?{logger}:{}),...(clock?{clock}:{})});
  function requireUser(req,res,next){if(!req.user)return res.status(401).json({error:req.sessionIssue||'login_required'});next();}
  const access=installAccess(db,billing,{...(aiConfig?{config:aiConfig}:{}),...(clock?{clock}:{})});
  billing.routes();
  app.get('/api/access',requireUser,(req,res)=>res.json({...access.summary(req.user.id),emailAvailable:accounts.emailAvailable,email:accounts.status(req.user.id)}));
  app.use('/api/exams',requireUser,access.guard('dele'));
  const learning = installLearning(app, db, { requireUser, bank, lessons, access, ...(clock?{clock}:{}) });
  installGoogle(app,db,{accounts,limit,languages,secure,...(googleConfig?{config:googleConfig}:{}),...(googleFetch?{requester:googleFetch}:{}),...(clock?{clock}:{})});
  const exams = installExams(app, db, { requireUser, sourceFetch });
  installTutor(app, db, { requireUser, access, ...(tutor ? { ai:tutor } : {}) });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', version:'0.5.0' }));
  app.get('/api/catalog', (req, res) => res.json({ lessons:billing.catalog(lessons,req.user?.id), tasks:req.user?Object.fromEntries(Object.entries(allTasks).filter(([id])=>access.has(req.user.id,'dele')||['writing','speaking'].includes(id))):{}, model, languages,planLimits:access.config.limits }));
  app.get('/api/lessons/:id',requireUser,(req,res)=>{
    const lesson=lessons.find(l=>l.id===req.params.id);
    if(!lesson)return res.status(404).json({error:'not_found'});
    if(!billing.canAccess(req.user?.id,lesson))return res.status(402).json({error:'subscription_required',module:lesson.module});
    res.json({lesson});
  });
  app.patch('/api/me', requireUser, (req, res) => {
    if (!languages.includes(req.body.language)) return res.status(400).json({ error: 'invalid_language' });
    db.prepare('UPDATE users SET language=? WHERE id=?').run(req.body.language, req.user.id);
    res.json({ ok: true });
  });
  app.get('/api/progress', requireUser, (req, res) => {
    const completed = db.prepare('SELECT lesson_id,completed_at FROM completions WHERE user_id=? ORDER BY completed_at DESC').all(req.user.id);
    const results = db.prepare('SELECT id,module,mode,created_at,result FROM quizzes WHERE user_id=? AND result IS NOT NULL ORDER BY created_at DESC,rowid DESC').all(req.user.id).map(q => ({ ...q, result: JSON.parse(q.result) }));
    const submissions = db.prepare('SELECT id,kind,text,rubric,feedback,created_at,task_id,exam_id,length(audio) AS audio_bytes FROM submissions WHERE user_id=? ORDER BY created_at DESC').all(req.user.id).map(s => ({ ...s, rubric: JSON.parse(s.rubric), feedback: s.feedback ? JSON.parse(s.feedback) : null }));
    const reviews = db.prepare('SELECT item_id,rating,created_at FROM review_log WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
    const activeDays = [...new Set([...completed.map(l => studyDate(l.completed_at)), ...results.map(r => studyDate(r.created_at)), ...submissions.map(s => studyDate(s.created_at)), ...reviews.map(r => studyDate(r.created_at))])].sort().reverse();
    let streak = 0;
    let cursor = new Date();
    if (!activeDays.includes(studyDate(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (activeDays.includes(studyDate(cursor))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    const skills = skillSummary(results, submissions);
    const badges = [completed.length > 0 && 'firstLesson', results.length > 0 && 'firstTest', activeDays.length >= 7 && 'sevenDays', reviews.length >= 10 && 'tenReviews', skills.filter(s => ['reading','listening','writing','speaking'].includes(s.id)).every(s => s.count > 0) && 'fourSkills'].filter(Boolean);
    res.json({ completed, results, submissions, activeDays, streak, skills, badges, reviewCount: reviews.length, facts:learning.facts.mastery(req.user.id), learningSteps:db.prepare('SELECT step_id,completed_at FROM learning_steps WHERE user_id=?').all(req.user.id) });
  });
  app.post('/api/lessons/:id/complete', requireUser, (req, res) => {
    const lesson=lessons.find(l=>l.id===req.params.id);
    if (!lesson) return res.status(404).json({ error: 'not_found' });
    if (!billing.canAccess(req.user.id,lesson)) return res.status(402).json({error:'subscription_required'});
    db.prepare('INSERT OR IGNORE INTO completions VALUES (?,?,?)').run(req.user.id, req.params.id, new Date().toISOString());
    res.json({ ok: true });
  });
  installQuizzes(app,db,{requireUser,bank,billing,lessons,access,facts:learning.facts,...(clock?{clock}:{})});
  app.post('/api/submissions', requireUser, (req, res) => {
    const { kind, text = '', audio, mime = '', rubric = [], task_id = kind, exam_id = null, purpose='practice' } = req.body;
    if (!['writing','speaking'].includes(kind) || !allTasks[task_id] || allTasks[task_id].kind !== kind || typeof text !== 'string' || text.length > 12000 || !Array.isArray(rubric) || rubric.some(v => !Number.isInteger(v) || v < 0 || v > 3) || rubric.length > 4) return res.status(400).json({ error: 'invalid_submission' });
    if(!access.has(req.user.id,'dele')&&!(purpose==='assessment'&&['writing','speaking'].includes(task_id)&&!exam_id))return res.status(402).json({error:'subscription_required',module:'dele'});
    let exam;
    if (exam_id) {
      exam = db.prepare('SELECT * FROM exam_attempts WHERE id=? AND user_id=?').get(exam_id, req.user.id);
      if (!exam || exam.stage !== kind || !model[kind].taskIds.includes(task_id)) return res.status(409).json({ error: 'exam_stage_changed' });
    }
    if (audio && (typeof audio !== 'string' || audio.length > 8000000 || !/^[A-Za-z0-9+/=]+$/.test(audio) || !/^audio\/(webm|mp4|ogg|mpeg|wav)(;codecs=[a-z0-9,.-]+)?$/i.test(mime))) return res.status(400).json({ error: 'invalid_audio' });
    if (!text.trim() && !audio) return res.status(400).json({ error: 'empty_submission' });
    const id = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO submissions(id,user_id,kind,text,audio,mime,rubric,feedback,created_at,task_id,exam_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id, req.user.id, kind, text, audio ? Buffer.from(audio, 'base64') : null, mime, JSON.stringify([...new Set(rubric)]), null, new Date().toISOString(), task_id, exam_id);
    if (exam) db.prepare('UPDATE exam_attempts SET submissions=? WHERE id=?').run(JSON.stringify({ ...JSON.parse(exam.submissions), [task_id]: id }), exam.id);
    res.status(201).json({ id });
  });
  app.get('/api/submissions/:id/audio', requireUser, (req, res) => {
    const row = db.prepare('SELECT audio,mime FROM submissions WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!row?.audio) return res.status(404).json({ error: 'not_found' });
    res.type(row.mime).send(Buffer.from(row.audio));
  });
  const aiBusy = new Set();
  app.post('/api/submissions/:id/evaluate', requireUser, async (req, res) => {
    const row = db.prepare('SELECT * FROM submissions WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    if (row.feedback) {if(!access.has(req.user.id,'dele'))return res.status(402).json({error:'subscription_required'});return res.json(JSON.parse(row.feedback));}
    if (aiBusy.has(req.user.id)) return res.status(429).json({ error: 'ai_busy' });
    if(!access.has(req.user.id,'dele'))return res.status(402).json({error:'subscription_required',module:'dele'});
    if(req.body.consent!==true)return res.status(400).json({error:'consent_required'});
    let reservation;try{reservation=access.reserve(req.user.id,'dele','corrections');}catch(error){return res.status(error.status||503).json({error:error.message,renewAt:error.renewAt});}
    aiBusy.add(req.user.id);
    try {
      const feedback = await ai({ ...access.config, kind: row.kind, text: row.text, audio: row.audio ? Buffer.from(row.audio).toString('base64') : null, mime: row.mime, language: req.user.language, task: (allTasks[row.task_id] || tasks[row.kind]).prompt });
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE submissions SET feedback=? WHERE id=?').run(JSON.stringify(feedback), row.id);
        access.finish(reservation,true);
        db.exec('COMMIT');
      } catch(error) {db.exec('ROLLBACK');throw error;}
      res.json(feedback);
    } catch (error) { access.finish(reservation,false);res.status(502).json({ error: ['ai_unavailable','ai_auth', 'ai_quota', 'ai_text', 'ai_format', 'ai_upstream'].includes(error.message) ? error.message : 'ai_network' }); }
    finally { aiBusy.delete(req.user.id); }
  });
  app.get('/api/export', requireUser, (req, res) => {
    const completions = db.prepare('SELECT lesson_id,completed_at FROM completions WHERE user_id=?').all(req.user.id);
    const quizzes = db.prepare('SELECT module,mode,created_at,result FROM quizzes WHERE user_id=? AND result IS NOT NULL').all(req.user.id).map(q => ({ ...q, result: JSON.parse(q.result) }));
    const submissions = db.prepare('SELECT kind,text,mime,rubric,feedback,created_at,audio,task_id,exam_id FROM submissions WHERE user_id=?').all(req.user.id).map(s => ({ ...s, audio: s.audio ? Buffer.from(s.audio).toString('base64') : null, rubric: JSON.parse(s.rubric), feedback: s.feedback ? JSON.parse(s.feedback) : null }));
    const plan = learning.getSettings(req.user.id);
    const reviews = db.prepare('SELECT item_id,kind,interval_days,repetitions,lapses,due_at,updated_at FROM review_state WHERE user_id=?').all(req.user.id);
    const examAttempts = db.prepare('SELECT * FROM exam_attempts WHERE user_id=?').all(req.user.id);
    const conversations = db.prepare('SELECT * FROM tutor_conversations WHERE user_id=?').all(req.user.id).map(c=>({...c,messages:db.prepare('SELECT role,content,created_at FROM tutor_messages WHERE conversation_id=? ORDER BY rowid').all(c.id)}));
    const factAttempts=db.prepare('SELECT fact_id,question_id,correct,study_day,created_at FROM fact_attempts WHERE user_id=?').all(req.user.id),learningSteps=db.prepare('SELECT step_id,completed_at FROM learning_steps WHERE user_id=?').all(req.user.id);
    res.attachment('rumbo-progress.json').json({ factAttempts,learningSteps,user: req.user, completions, quizzes, submissions, plan, reviews, examAttempts, conversations, billing:billing.summary(req.user.id) });
  });
  app.delete('/api/me', requireUser, async (req, res) => {
    try { await billing.cancelForDeletion(req.user.id); }
    catch { return res.status(503).json({error:'billing_delete_failed'}); }
    db.prepare('DELETE FROM users WHERE id=?').run(req.user.id); res.clearCookie('rumbo_session', { path: '/' }); res.json({ ok: true });
  });

  let checking = false;
  async function checkSources() {
    if (checking) return;
    checking = true;
    try {
      await Promise.all(officialSources.map(async source => {
        const now = new Date().toISOString();
        const previous = db.prepare('SELECT * FROM sources WHERE id=?').get(source.id);
        try {
          const response = await sourceFetch(source.url, { signal: AbortSignal.timeout(12000), redirect: 'error', headers: { 'User-Agent': 'Rumbo-study-source-monitor/0.1' } });
          if (!response.ok) throw new Error('http_' + response.status);
          if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('unexpected_content');
          let body = '';
          const decoder = new TextDecoder();
          for await (const chunk of response.body) { body += decoder.decode(chunk, { stream: true }); if (body.length > 3000000) throw new Error('response_too_large'); }
          body += decoder.decode();
          const materials = extractMaterials(body, source);
          if (!materials.length) throw new Error('materials_not_found');
          const fingerprint = materialFingerprint(materials);
          db.prepare('UPDATE sources SET checked_at=?,verified_at=?,fingerprint=?,changed_at=?,error=NULL,materials=? WHERE id=?').run(now, now, fingerprint, previous.fingerprint && previous.fingerprint !== fingerprint ? now : previous.changed_at, JSON.stringify(materials), source.id);
        } catch (error) { db.prepare('UPDATE sources SET checked_at=?,error=? WHERE id=?').run(now, error.message.startsWith('http_') || ['materials_not_found', 'unexpected_content'].includes(error.message) ? error.message : 'network_unavailable', source.id); }
      }));
      await exams.checkKeys();
    } finally { checking = false; }
  }
  app.get('/api/sources', (_req, res) => res.json({ sources: officialSources.map(s => { const row = db.prepare('SELECT * FROM sources WHERE id=?').get(s.id); return { ...s, ...row, materials: JSON.parse(row.materials) }; }), checking }));
  app.post('/api/sources/check', requireUser, async (_req, res) => {
    const latest = db.prepare('SELECT MAX(checked_at) AS last FROM sources').get().last;
    if (!latest || Date.now() - Date.parse(latest) > 3600000) await checkSources();
    res.json({ ok: true });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((error, _req, res, _next) => { res.status(error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500).json({ error: error.type === 'entity.too.large' ? 'too_large' : 'request_failed' }); });
  return { app, db, bank, learning, checkSources };
}
