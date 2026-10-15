import { randomBytes } from 'node:crypto';
export const DAY = 86400000;
export const studyDate = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY).toISOString();

export const vocabulary = [
  ['cita previa', 'Reserva de un día y una hora para recibir atención.', 'He pedido cita previa en el centro de salud.'],
  ['empadronarse', 'Inscribirse como residente en el padrón municipal.', 'Voy a empadronarme en mi nuevo municipio.'],
  ['solicitud', 'Documento con el que se pide algo a una administración.', 'He presentado la solicitud por internet.'],
  ['plazo', 'Tiempo disponible para hacer un trámite.', 'El plazo termina el viernes.'],
  ['requisito', 'Condición necesaria para conseguir algo.', 'Tengo que comprobar los requisitos de inscripción.'],
  ['adjuntar', 'Añadir un documento a una solicitud o mensaje.', 'Debes adjuntar una copia del pasaporte.'],
  ['renovar', 'Dar nueva validez a un documento que caduca.', 'Tengo que renovar mi permiso.'],
  ['caducar', 'Dejar de tener validez por el paso del tiempo.', 'Mi tarjeta caduca en diciembre.'],
  ['alquiler', 'Pago por usar una vivienda que pertenece a otra persona.', 'El alquiler incluye los gastos de agua.'],
  ['fianza', 'Dinero entregado como garantía al alquilar.', 'La fianza es de una mensualidad.'],
  ['factura', 'Documento que indica una compra o servicio y su precio.', 'Necesito una factura de la reparación.'],
  ['devolución', 'Acción de devolver un producto o dinero.', 'Quiero solicitar la devolución del importe.'],
  ['billete de ida y vuelta', 'Billete para ir a un lugar y regresar.', 'Quiero un billete de ida y vuelta a Toledo.'],
  ['transbordo', 'Cambio de un medio de transporte a otro.', 'Hay que hacer transbordo en la próxima estación.'],
  ['retraso', 'Llegada o realización después de la hora prevista.', 'El autobús lleva diez minutos de retraso.'],
  ['andén', 'Zona de una estación desde la que se accede al tren.', 'El tren sale del andén tres.'],
  ['receta', 'Documento médico para obtener un medicamento.', 'Para este medicamento necesitas receta.'],
  ['síntoma', 'Señal de una enfermedad o problema de salud.', 'Tengo fiebre y dolor de cabeza. Son mis síntomas.'],
  ['ayuntamiento', 'Institución que gobierna y administra un municipio.', 'El ayuntamiento está en la plaza mayor.'],
  ['derecho', 'Facultad o protección reconocida por una norma.', 'La educación es un derecho.'],
  ['deber', 'Obligación que una persona tiene que cumplir.', 'Contribuir a los gastos públicos es un deber.'],
  ['aunque', 'Conector que introduce una dificultad que no impide algo.', 'Aunque llueve, voy a salir.'],
  ['sin embargo', 'Expresión que presenta un contraste.', 'Quería ir al cine; sin embargo, estaba cerrado.'],
  ['todavía', 'Indica que una situación continúa.', 'Todavía no he terminado la tarea.'],
  ['ya', 'Indica que un cambio o una acción se ha completado.', 'Ya he enviado el correo.'],
  ['soler', 'Hacer algo habitualmente.', 'Suelo estudiar por la tarde.'],
  ['quedar', 'Acordar una cita o encuentro.', '¿Quedamos mañana a las seis?'],
  ['me gustaría', 'Expresión cortés de un deseo.', 'Me gustaría reservar una habitación.'],
  ['acabo de', 'Expresa una acción terminada hace poco.', 'Acabo de llegar a casa.'],
  ['llevar + tiempo', 'Indica cuánto dura una situación.', 'Llevo dos años viviendo aquí.'],
].map(([front, back, example], i) => ({ id: `vocab-${i + 1}`, kind: 'vocabulary', module: 'dele', front, back, example }));

export function nextReview(previous, rating, now = new Date()) {
  const repetitions = previous?.repetitions || 0;
  const last = previous?.interval_days || 0;
  const interval = rating === 'again' ? 10 / 1440 : rating === 'hard' ? Math.max(.5, last * 1.2) : rating === 'easy' ? Math.max(3, last * 3) : Math.max(1, last ? last * 2 : 1);
  return { interval_days: Math.min(180, interval), repetitions: rating === 'again' ? 0 : repetitions + 1, lapses: (previous?.lapses || 0) + (rating === 'again' ? 1 : 0), due_at: addDays(now, Math.min(180, interval)), updated_at: new Date(now).toISOString() };
}

export function skillSummary(results, submissions) {
  const names = ['government', 'geography', 'culture', 'society', 'reading', 'listening'];
  const skills = names.map(id => {
    const answers = results.flatMap(r => r.result.answers || []).filter(a => a.category === id).slice(0, 30);
    const recent = answers.slice(0, 10), older = answers.slice(10, 20);
    const pct = xs => xs.length ? Math.round(xs.filter(a => a.isCorrect).length / xs.length * 100) : null;
    return { id, count: answers.length, percent: pct(answers), trend: recent.length >= 5 && older.length >= 5 ? pct(recent) - pct(older) : null, evidence: answers.length >= 10 ? 'sampled' : answers.length ? 'limited' : 'missing' };
  });
  for (const id of ['writing', 'speaking']) {
    const entries = submissions.filter(s => s.kind === id);
    skills.push({ id, count: entries.length, percent: null, evidence: entries.some(s => s.feedback) ? 'ai_feedback' : entries.length ? 'self_assessment' : 'missing' });
  }
  return skills;
}

export function estimatePlan(settings, results, submissions, now = new Date()) {
  const baseline = results.find(r => r.mode === 'assessment');
  const skills = skillSummary(results, submissions);
  const getBaseline = module => {
    const answers = baseline?.result.answers.filter(a => module === 'ccse' ? a.module === 'ccse' : ['reading', 'listening'].includes(a.category)) || [];
    return answers.length ? answers.filter(a => a.isCorrect).length / answers.length : .35;
  };
  const latest = module => {
    const answers = results.filter(r => r.mode !== 'assessment').flatMap(r => r.result.answers || []).filter(a => a.module === module).slice(0, 50);
    return answers.length >= 10 ? answers.filter(a => a.isCorrect).length / answers.length : getBaseline(module);
  };
  const selfCoverage=kind=>{const s=submissions.find(s=>s.kind===kind);if(!s)return .35;const rubric=Array.isArray(s.rubric)?s.rubric:[];return Math.min(1,new Set(rubric).size/4);};
  const hours = { ccse: Math.ceil(6 + (1 - latest('ccse')) * 18), dele: Math.ceil(12 + (1 - latest('dele')) * 48 + (1-selfCoverage('writing'))*8 + (1-selfCoverage('speaking'))*8) };
  const weeklyHours = settings.sessions_week * settings.session_minutes / 60;
  const forecast = modules => {
    const workload = modules.reduce((sum, m) => sum + hours[m], 0);
    const weeks = Math.max(2, Math.ceil(workload / weeklyHours));
    const upper = Math.max(weeks + 1, Math.ceil(workload * 1.35 / weeklyHours));
    return { weeks, upperWeeks: upper, from: addDays(now, weeks * 7), to: addDays(now, upper * 7), estimatedHours: workload };
  };
  const selected = settings.goal === 'both' ? ['ccse', 'dele'] : [settings.goal];
  const combined = forecast(selected);
  return { ...combined, modules: Object.fromEntries(selected.map(m => [m, forecast([m])])), weeklyHours, provisional: !baseline || !submissions.some(s => s.kind === 'writing') || !submissions.some(s => s.kind === 'speaking'), assessmentDate: baseline?.created_at || null, targetTooSoon: !!settings.target_date && settings.target_date < studyDate(combined.from), skills, method: 'heuristic-v1', computedAt: new Date(now).toISOString() };
}

export function installLearning(app, db, { requireUser, questions, lessons, clock = () => new Date() }) {
  db.exec(`CREATE TABLE IF NOT EXISTS study_settings (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, goal TEXT NOT NULL DEFAULT 'both', sessions_week INTEGER NOT NULL DEFAULT 3, session_minutes INTEGER NOT NULL DEFAULT 30, target_date TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS review_state (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_id TEXT NOT NULL, kind TEXT NOT NULL, interval_days REAL NOT NULL, repetitions INTEGER NOT NULL, lapses INTEGER NOT NULL, due_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,item_id));
    CREATE TABLE IF NOT EXISTS review_log (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_id TEXT NOT NULL, rating TEXT NOT NULL, created_at TEXT NOT NULL);`);
  const list = userId => ({
    results: db.prepare('SELECT module,mode,created_at,result FROM quizzes WHERE user_id=? AND result IS NOT NULL ORDER BY created_at DESC,rowid DESC').all(userId).map(r => ({ ...r, result: JSON.parse(r.result) })),
    submissions: db.prepare('SELECT kind,feedback,rubric,created_at FROM submissions WHERE user_id=? ORDER BY created_at DESC').all(userId).map(s=>({...s,rubric:JSON.parse(s.rubric)})),
  });
  const getSettings = userId => db.prepare('SELECT goal,sessions_week,session_minutes,target_date,updated_at FROM study_settings WHERE user_id=?').get(userId) || { goal: 'both', sessions_week: 3, session_minutes: 30, target_date: null, updated_at: null };
  const items = [...vocabulary, ...questions.map(q => ({ id: q.id, kind: 'question', module: q.module, category: q.category, front: q.prompt, back: q.options[q.correct], example: q.explanation }))];
  const record = (userId, itemId, kind, rating, log = true) => {
    const previous = db.prepare('SELECT * FROM review_state WHERE user_id=? AND item_id=?').get(userId, itemId);
    const state = nextReview(previous, rating, clock());
    db.prepare('INSERT INTO review_state VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET interval_days=excluded.interval_days,repetitions=excluded.repetitions,lapses=excluded.lapses,due_at=excluded.due_at,updated_at=excluded.updated_at').run(userId, itemId, kind, state.interval_days, state.repetitions, state.lapses, state.due_at, state.updated_at);
    if (log) db.prepare('INSERT INTO review_log VALUES (?,?,?,?,?)').run(randomBytes(16).toString('hex'), userId, itemId, rating, state.updated_at);
    return state;
  };
  app.get('/api/plan', requireUser, (req, res) => {
    const settings = getSettings(req.user.id), history = list(req.user.id), estimate = estimatePlan(settings, history.results, history.submissions, clock());
    const allowed=settings.goal==='ccse'?['government','geography','culture','society']:settings.goal==='dele'?['reading','listening']:['government','geography','culture','society','reading','listening'];
    const weakest = estimate.skills.filter(s => s.percent !== null&&allowed.includes(s.id)).sort((a, b) => a.percent - b.percent)[0];
    const pendingProductive=settings.goal!=='ccse'&&history.results.some(r=>r.mode==='assessment')?['writing','speaking'].find(kind=>!history.submissions.some(s=>s.kind===kind)):null;
    const category=pendingProductive||weakest?.id||(settings.goal==='ccse'?'government':'reading');
    const done = new Set(db.prepare('SELECT lesson_id FROM completions WHERE user_id=?').all(req.user.id).map(c => c.lesson_id));
    const selected=lessons.filter(l=>settings.goal==='both'||l.module===settings.goal);
    const candidate = selected.find(l => !done.has(l.id) && l.category === category) || selected.find(l => !done.has(l.id));
    res.json({ settings, estimate, recommendation: { category: candidate?.category||category, lessonId: candidate?.id || null }, officialCalendar: { ccse: 'https://examenes.cervantes.es/es/ccse/cuando', dele: 'https://examenes.cervantes.es/es/dele/cuando' } });
  });
  app.put('/api/plan', requireUser, (req, res) => {
    const { goal, sessions_week, session_minutes, target_date = null } = req.body;
    if (!['both', 'ccse', 'dele'].includes(goal) || !Number.isInteger(sessions_week) || sessions_week < 1 || sessions_week > 7 || ![15, 20, 30, 45, 60, 90].includes(session_minutes) || (target_date !== null && (typeof target_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(target_date) || !Number.isFinite(Date.parse(target_date)) || new Date(target_date).toISOString().slice(0, 10) !== target_date || target_date < studyDate(clock())))) return res.status(400).json({ error: 'invalid_plan' });
    db.prepare('INSERT INTO study_settings VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET goal=excluded.goal,sessions_week=excluded.sessions_week,session_minutes=excluded.session_minutes,target_date=excluded.target_date,updated_at=excluded.updated_at').run(req.user.id, goal, sessions_week, session_minutes, target_date, clock().toISOString());
    res.json({ ok: true });
  });
  app.get('/api/review', requireUser, (req, res) => {
    const states = new Map(db.prepare('SELECT * FROM review_state WHERE user_id=?').all(req.user.id).map(s => [s.item_id, s]));
    const selected = items.filter(item => (!req.query.module || item.module === req.query.module) && (!req.query.kind || item.kind === req.query.kind));
    const due = selected.filter(item => states.has(item.id) && states.get(item.id).due_at <= clock().toISOString()).sort((a, b) => states.get(a.id).due_at.localeCompare(states.get(b.id).due_at));
    const fresh = selected.filter(item => !states.has(item.id));
    res.json({ cards: [...due, ...fresh].slice(0, 10).map(item => ({ ...item, state: states.get(item.id) || null })), dueCount: due.length, newCount: fresh.length, learningCount: states.size, nextDue: selected.map(item => states.get(item.id)?.due_at).filter(d => d && d > clock().toISOString()).sort()[0] || null });
  });
  app.post('/api/review/:id/rate', requireUser, (req, res) => {
    const item = items.find(item => item.id === req.params.id);
    if (!item || !['again', 'hard', 'good', 'easy'].includes(req.body.rating)) return res.status(400).json({ error: 'invalid_review' });
    res.json(record(req.user.id, item.id, item.kind, req.body.rating));
  });
  return { record, list, getSettings };
}
