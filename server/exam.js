import { randomBytes, createHash } from 'node:crypto';
const base = 'https://examenes.cervantes.es/sites/default/files/';
const letters = 'ABCDEFGHIJK'.split('');
export const model = {
  id: 'dele-a2-0220', title: 'DELE A2 · Modelo oficial de práctica', source: 'Instituto Cervantes', reviewedAt: '2026-10-15',
  guide: base + 'DELE_A2_v2020_Gu%C3%ADa_de_examen_0.pdf',
  reading: { minutes: 60, sizes: [5, 8, 6, 6], documents: [1, 2, 3, 4].map(i => base + `a2/A2_0220_CL_T${i}.pdf`), key: base + 'a2/A2_0220_CL_Claves.pdf', sha256: '067d8e5b5f2fc5c1998619d00ca54be2c2357a0b3cef41d6a3ecc59ba5478054' },
  listening: { minutes: 40, sizes: [6, 6, 6, 7], documents: [1, 2, 3, 4].map(i => base + `a2/A2_0220_CA_T${i}.pdf`), audio: [1, 2, 3, 4].map(i => base + `audio/a2/A2_0220_CA_Audio_T${i}.mp3`), key: base + 'a2/A2_0220_CA_Claves.pdf', sha256: '33e067761b3a6819db924234c2b522570c5ef73ef2ed729eba8879405bbb20fd' },
  writing: { minutes: 45, taskIds: ['model-writing-1', 'model-writing-2'] },
  preparation: { minutes: 12 },
  speaking: { minutes: 12, taskIds: ['model-speaking-1', 'model-speaking-2', 'model-speaking-3'] },
};
const keys = { reading: 'C B B A C B C B C B B A A B B A C C B B C A A C C'.split(' '), listening: 'C B A C B C B C B C A A B C B B A C H K D I E C A'.split(' ') };
export const examTasks = {
  'model-writing-1': { kind: 'writing', document: base + 'a2/A2_0220_EIE_T1.pdf', prompt: 'Responde a una amistad que pregunta por tu nueva vida en una ciudad española. Cuenta en qué trabajas, cómo es la ciudad, cómo son las personas con las que compartes vivienda e invita a tu amistad a visitarte. Incluye saludo y despedida. Escribe entre 60 y 70 palabras. Consulta el documento oficial para las instrucciones completas.', model: 'Comprueba el saludo, la respuesta a todos los puntos y la despedida. El modelo de esta tarea se consulta en el documento oficial; no uses como respuesta un texto memorizado.', rubric: ['He respondido a todos los puntos del documento.', 'He escrito un mensaje adecuado al destinatario.', 'He usado conectores y verbos comprensibles.', 'He revisado la extensión y la concordancia.'] },
  'model-writing-2': { kind: 'writing', document: base + 'a2/A2_0220_EIE_T2.pdf', prompt: 'Elige una opción del documento: A, cuenta tus vacaciones habituales, forma de viajar, destinos, últimas vacaciones y planes; B, relata el fin de semana de Miguel siguiendo la agenda del PDF, distinguiendo las actividades que realizó de las tachadas. Indica la opción elegida. Escribe entre 70 y 80 palabras. Para B, añade al comienzo una breve referencia a los datos de la agenda para que el tutor pueda contrastar tu respuesta.', model: 'Organiza tu texto con una introducción, información sobre todos los puntos pedidos y una conclusión breve. Revisa los tiempos verbales y las referencias a personas y lugares.', rubric: ['He indicado la opción elegida.', 'He desarrollado todos los puntos solicitados.', 'He ordenado los hechos con claridad.', 'He revisado el texto y su extensión.'] },
  'model-speaking-1': { kind: 'speaking', document: base + 'DELE_A2_0222_EIO_SALA_EXAMEN_CANDIDATO_T1.pdf', prompt: 'Consulta el documento oficial, elige un tema y realiza una exposición de 2 a 3 minutos siguiendo sus indicaciones. Introduce el tema y añade detalles personales relevantes.', model: 'Empieza diciendo el tema que has elegido. Usa frases completas y ejemplos de tu vida. Une las ideas con «también», «porque», «después» y «pero».', rubric: ['He seguido las indicaciones del tema.', 'He hablado durante aproximadamente 2 o 3 minutos.', 'He añadido detalles y ejemplos.', 'Mi mensaje se entiende al escucharlo.'] },
  'model-speaking-2': { kind: 'speaking', document: base + 'DELE_A2_0222_EIO_SALA_EXAMEN_CANDIDATO_T2_T3.pdf', prompt: 'Abre el documento oficial y elige una fotografía para la tarea 2. Describe durante 2 o 3 minutos el lugar, las personas, sus acciones y los detalles que observas. Consulta las preguntas del documento.', model: 'Puedes empezar con «En esta fotografía hay…». Describe primero el lugar y las personas, después sus acciones y, al final, otros detalles. Distingue lo que ves de lo que imaginas.', rubric: ['He descrito personas y lugar.', 'He explicado qué están haciendo.', 'He usado expresiones de posición y descripción.', 'He distinguido observaciones de suposiciones.'] },
  'model-speaking-3': { kind: 'speaking', document: base + 'DELE_A2_0222_EIO_SALA_EXAMEN_CANDIDATO_T2_T3.pdf', prompt: 'Consulta la situación de la tarea 3 del documento. Practica una interacción de 3 a 4 minutos con otra persona o con el tutor de IA: pregunta, responde, pide aclaraciones y llega a un acuerdo. Una grabación individual no sustituye la interacción con un interlocutor.', model: 'Para iniciar: «Buenos días, quería preguntar…». Para aclarar: «¿Puede repetir, por favor?». Para proponer: «¿Le parece bien…?». Para terminar: «Muchas gracias por su ayuda».', rubric: ['He planteado la situación de la tarea.', 'He formulado preguntas y respondido.', 'He pedido o dado información concreta.', 'He cerrado la conversación adecuadamente.'] },
};
export const stages = ['reading', 'listening', 'writing', 'preparation', 'speaking', 'done'];
export function gradeModel(kind, answers) {
  return keys[kind].map((correct, index) => ({ id: `model-0220-${kind}-${index + 1}`, module: 'dele', category: kind, prompt: `Modelo oficial · ${kind === 'reading' ? 'Lectura' : 'Comprensión auditiva'} · Ítem ${index + 1}`, options: letters, correct: letters.indexOf(correct), selected: answers[index] === null ? null : letters.indexOf(answers[index]), isCorrect: answers[index] === correct, explanation: 'Clave publicada por el Instituto Cervantes: ' + model[kind].key }));
}
export function installExams(app, db, { requireUser, clock = () => new Date(), sourceFetch = fetch }) {
  db.exec(`CREATE TABLE IF NOT EXISTS exam_attempts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, stage TEXT NOT NULL, started_at TEXT NOT NULL, stage_started_at TEXT NOT NULL, submissions TEXT NOT NULL DEFAULT '{}', completed_at TEXT);
    CREATE INDEX IF NOT EXISTS exam_user ON exam_attempts(user_id,started_at);
    CREATE TABLE IF NOT EXISTS model_audits (kind TEXT PRIMARY KEY, checked_at TEXT, status TEXT NOT NULL, hash TEXT);`);
  if(!db.prepare('PRAGMA table_info(exam_attempts)').all().some(c=>c.name==='answers'))db.exec("ALTER TABLE exam_attempts ADD COLUMN answers TEXT NOT NULL DEFAULT '{}'");
  async function checkKeys() {
    await Promise.all(['reading','listening'].map(async kind => {
      try {
        const r = await sourceFetch(model[kind].key, { signal: AbortSignal.timeout(12000), redirect: 'error' });
        if (!r.ok) throw new Error('network');
        const chunks = []; let length = 0;
        for await (const chunk of r.body) { length += chunk.length; if (length > 1000000) throw new Error('size'); chunks.push(chunk); }
        const buffer = Buffer.concat(chunks);
        if (buffer.subarray(0,4).toString() !== '%PDF') throw new Error('format');
        const hash = createHash('sha256').update(buffer).digest('hex');
        db.prepare('INSERT INTO model_audits VALUES (?,?,?,?) ON CONFLICT(kind) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,hash=excluded.hash').run(kind, clock().toISOString(), hash === model[kind].sha256 ? 'verified' : 'changed', hash);
      } catch {
        db.prepare("INSERT INTO model_audits VALUES (?,?,'unavailable',NULL) ON CONFLICT(kind) DO UPDATE SET checked_at=excluded.checked_at,status=CASE WHEN model_audits.status='changed' THEN 'changed' ELSE 'unavailable' END").run(kind, clock().toISOString());
      }
    }));
  }
  function serialize(row) {
    const linked = JSON.parse(row.submissions);
    const submissions = {};
    for (const [taskId, id] of Object.entries(linked)) {
      const s = db.prepare('SELECT id,kind,text,rubric,feedback,length(audio) AS audio_bytes,task_id FROM submissions WHERE id=? AND user_id=?').get(id, row.user_id);
      if (s) submissions[taskId] = { ...s, rubric: JSON.parse(s.rubric), feedback: s.feedback ? JSON.parse(s.feedback) : null };
    }
    return { ...row, answers:JSON.parse(row.answers), submissions, deadline: row.stage === 'done' ? null : new Date(Date.parse(row.stage_started_at) + model[row.stage].minutes * 60000).toISOString(), results: db.prepare("SELECT result FROM quizzes WHERE user_id=? AND id IN (?,?)").all(row.user_id, row.id + '-reading', row.id + '-listening').map(r => JSON.parse(r.result)) };
  }
  app.get('/api/exams', requireUser, (req, res) => res.json({ model, audits: db.prepare('SELECT * FROM model_audits').all(), attempts: db.prepare('SELECT * FROM exam_attempts WHERE user_id=? ORDER BY started_at DESC').all(req.user.id).map(serialize) }));
  app.post('/api/exams', requireUser, (req, res) => {
    if (db.prepare("SELECT kind FROM model_audits WHERE status='changed'").get()) return res.status(409).json({ error: 'model_changed' });
    const id = randomBytes(16).toString('hex'), now = clock().toISOString();
    db.prepare('INSERT INTO exam_attempts(id,user_id,stage,started_at,stage_started_at) VALUES (?,?,?,?,?)').run(id, req.user.id, 'reading', now, now);
    res.status(201).json(serialize(db.prepare('SELECT * FROM exam_attempts WHERE id=?').get(id)));
  });
  app.get('/api/exams/:id', requireUser, (req, res) => { const row = db.prepare('SELECT * FROM exam_attempts WHERE id=? AND user_id=?').get(req.params.id, req.user.id); if (!row) return res.status(404).json({ error: 'not_found' }); res.json(serialize(row)); });
  const validAnswers=(kind,answers)=>Array.isArray(answers)&&answers.length===25&&answers.every((a,i)=>a===null||(typeof a==='string'&&letters.slice(0,kind==='listening'&&i>=18?11:3).includes(a)));
  app.patch('/api/exams/:id/answers',requireUser,(req,res)=>{
    const row=db.prepare('SELECT * FROM exam_attempts WHERE id=? AND user_id=?').get(req.params.id,req.user.id);
    if(!row)return res.status(404).json({error:'not_found'});
    if(!['reading','listening'].includes(row.stage)||req.body.stage!==row.stage||!validAnswers(row.stage,req.body.answers))return res.status(400).json({error:'invalid_answers'});
    db.prepare('UPDATE exam_attempts SET answers=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.answers),[row.stage]:req.body.answers}),row.id);
    res.json({ok:true});
  });
  app.post('/api/exams/:id/advance', requireUser, (req, res) => {
    if (db.prepare("SELECT kind FROM model_audits WHERE status='changed'").get()) return res.status(409).json({ error: 'model_changed' });
    const row = db.prepare('SELECT * FROM exam_attempts WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    if (req.body.stage !== row.stage || row.stage === 'done') return res.status(409).json({ error: 'exam_stage_changed' });
    const now = clock().toISOString();
    if (['reading', 'listening'].includes(row.stage)) {
      const answers = req.body.answers;
      if (!validAnswers(row.stage,answers)) return res.status(400).json({ error: 'invalid_answers' });
      const graded = gradeModel(row.stage, answers), score = graded.filter(a => a.isCorrect).length;
      const result = { id: row.id + '-' + row.stage, module: 'dele', mode: 'official_model', score, total: 25, percent: score * 4, skills: { [row.stage]: { correct: score, total: 25 } }, answers: graded, finishedAt: now, source: model.source, sourceUrl: model[row.stage].key };
      db.prepare('INSERT INTO quizzes(id,user_id,module,mode,question_ids,created_at,result) VALUES (?,?,?,?,?,?,?)').run(result.id, req.user.id, 'dele', 'official_model', '[]', now, JSON.stringify(result));
    }
    // Preparation can be ended early; remaining tasks are explicitly recorded as missing.
    const next = stages[stages.indexOf(row.stage) + 1];
    db.prepare('UPDATE exam_attempts SET stage=?,stage_started_at=?,completed_at=? WHERE id=?').run(next, now, next === 'done' ? now : null, row.id);
    res.json(serialize(db.prepare('SELECT * FROM exam_attempts WHERE id=?').get(row.id)));
  });
  return { serialize, checkKeys };
}
