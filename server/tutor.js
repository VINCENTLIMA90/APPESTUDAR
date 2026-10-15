import { randomBytes } from 'node:crypto';
import { providers, tutorAI } from './ai.js';
export function installTutor(app, db, { requireUser, ai = tutorAI }) {
  db.exec(`CREATE TABLE IF NOT EXISTS tutor_conversations (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,mode TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tutor_messages (id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES tutor_conversations(id) ON DELETE CASCADE,role TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL);`);
  const busy = new Set();
  const messages = id => db.prepare('SELECT role,content,created_at FROM tutor_messages WHERE conversation_id=? ORDER BY rowid ASC').all(id).map(m => ({ ...m, content: JSON.parse(m.content) }));
  app.get('/api/tutor', requireUser, (req,res) => res.json({ conversations: db.prepare('SELECT id,mode,created_at FROM tutor_conversations WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(req.user.id).map(c => ({ ...c, messages: messages(c.id) })) }));
  app.post('/api/tutor/chat', requireUser, async (req,res) => {
    const { provider, key, message, conversationId, mode = 'conversation', consent } = req.body;
    if (consent !== true || !providers[provider] || typeof key !== 'string' || key.length < 10 || key.length > 1024 || typeof message !== 'string' || !message.trim() || message.length > 2500 || !['conversation','explain','drill'].includes(mode)) return res.status(400).json({ error: 'invalid_tutor' });
    const conversation = conversationId ? db.prepare('SELECT * FROM tutor_conversations WHERE id=? AND user_id=?').get(conversationId,req.user.id) : null;
    if (conversationId && !conversation) return res.status(404).json({ error: 'not_found' });
    if (busy.has(req.user.id)) return res.status(429).json({ error: 'ai_busy' });
    const id = conversation?.id || randomBytes(16).toString('hex');
    const recent = db.prepare('SELECT result FROM quizzes WHERE user_id=? AND result IS NOT NULL ORDER BY created_at DESC LIMIT 3').all(req.user.id).map(q=>JSON.parse(q.result));
    const errors = recent.flatMap(r=>r.answers.filter(a=>!a.isCorrect)).slice(0,5).map(a=>({topic:a.category,question:a.prompt,explanation:a.explanation}));
    const feedback = db.prepare('SELECT feedback FROM submissions WHERE user_id=? AND feedback IS NOT NULL ORDER BY created_at DESC LIMIT 1').get(req.user.id);
    const context = JSON.stringify({ errors, improvements: feedback ? JSON.parse(feedback.feedback).improvements : [] });
    const history = conversation ? messages(id).slice(-10).map(m=>({role:m.role,content:m.content})) : [];
    busy.add(req.user.id);
    try {
      const reply = await ai({ provider,key,messages:[...history,{role:'user',content:message.trim()}],language:req.user.language,context,mode:conversation?.mode || mode });
      const now = new Date().toISOString();
      db.exec('BEGIN');
      try {
        if (!conversation) db.prepare('INSERT INTO tutor_conversations VALUES (?,?,?,?)').run(id,req.user.id,mode,now);
        db.prepare('INSERT INTO tutor_messages VALUES (?,?,?,?,?)').run(randomBytes(16).toString('hex'),id,'user',JSON.stringify(message.trim()),now);
        db.prepare('INSERT INTO tutor_messages VALUES (?,?,?,?,?)').run(randomBytes(16).toString('hex'),id,'assistant',JSON.stringify(reply),now);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      res.json({ id, mode: conversation?.mode || mode, messages:messages(id) });
    } catch(e) { res.status(502).json({error:['ai_auth','ai_quota','ai_format','ai_upstream'].includes(e.message)?e.message:'ai_network'}); }
    finally { busy.delete(req.user.id); }
  });
}
