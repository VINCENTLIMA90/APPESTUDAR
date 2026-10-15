import { randomBytes } from 'node:crypto';
import { tutorAI } from './ai.js';
export function installTutor(app, db, { requireUser, access, ai = tutorAI }) {
  db.exec(`CREATE TABLE IF NOT EXISTS tutor_conversations (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,mode TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tutor_messages (id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES tutor_conversations(id) ON DELETE CASCADE,role TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL);`);
  if(!db.prepare('PRAGMA table_info(tutor_conversations)').all().some(c=>c.name==='module'))db.exec("ALTER TABLE tutor_conversations ADD COLUMN module TEXT NOT NULL DEFAULT 'dele'");
  const busy = new Set();
  const messages = id => db.prepare('SELECT role,content,created_at FROM tutor_messages WHERE conversation_id=? ORDER BY rowid ASC').all(id).map(m => ({ ...m, content: JSON.parse(m.content) }));
  app.get('/api/tutor', requireUser, (req,res) => {if(!access.has(req.user.id,req.query.module||'dele'))return res.status(402).json({error:'subscription_required'});return res.json({ conversations: db.prepare('SELECT id,mode,created_at,module FROM tutor_conversations WHERE user_id=? AND module=? ORDER BY created_at DESC LIMIT 20').all(req.user.id,req.query.module||'dele').map(c => ({ ...c, messages: messages(c.id) })) });});
  app.post('/api/tutor/chat', requireUser, async (req,res) => {
    const { module='dele', message, conversationId, mode = 'conversation', consent } = req.body;
    if(!access.has(req.user.id,module))return res.status(402).json({error:'subscription_required',module});
    if (consent !== true || typeof message !== 'string' || !message.trim() || message.length > 2500 || !['conversation','explain','drill'].includes(mode)) return res.status(400).json({ error: 'invalid_tutor' });
    const conversation = conversationId ? db.prepare('SELECT * FROM tutor_conversations WHERE id=? AND user_id=?').get(conversationId,req.user.id) : null;
    if(conversation&&conversation.module!==module)return res.status(402).json({error:'subscription_required'});
    if (conversationId && !conversation) return res.status(404).json({ error: 'not_found' });
    if (busy.has(req.user.id)) return res.status(429).json({ error: 'ai_busy' });
    let reservation;try{reservation=access.reserve(req.user.id,module,'tutor');}catch(error){return res.status(error.status||503).json({error:error.message,renewAt:error.renewAt});}
    const id = conversation?.id || randomBytes(16).toString('hex');
    const recent = db.prepare('SELECT result FROM quizzes WHERE user_id=? AND module=? AND result IS NOT NULL ORDER BY created_at DESC LIMIT 3').all(req.user.id,module).map(q=>JSON.parse(q.result));
    const errors = recent.flatMap(r=>r.answers.filter(a=>!a.isCorrect)).slice(0,5).map(a=>({topic:a.category,question:a.prompt,explanation:a.explanation}));
    const feedback = module==='ccse'?null:db.prepare('SELECT feedback FROM submissions WHERE user_id=? AND feedback IS NOT NULL ORDER BY created_at DESC LIMIT 1').get(req.user.id);
    const context = JSON.stringify({ errors, improvements: feedback ? JSON.parse(feedback.feedback).improvements : [] });
    const history = conversation ? messages(id).slice(-10).map(m=>({role:m.role,content:m.content})) : [];
    busy.add(req.user.id);
    try {
      const reply = await ai({ ...access.config,module,messages:[...history,{role:'user',content:message.trim()}],language:req.user.language,context,mode:conversation?.mode || mode });
      const now = new Date().toISOString();
      db.exec('BEGIN');
      try {
        if (!conversation) db.prepare('INSERT INTO tutor_conversations(id,user_id,mode,created_at,module) VALUES (?,?,?,?,?)').run(id,req.user.id,mode,now,module);
        db.prepare('INSERT INTO tutor_messages VALUES (?,?,?,?,?)').run(randomBytes(16).toString('hex'),id,'user',JSON.stringify(message.trim()),now);
        db.prepare('INSERT INTO tutor_messages VALUES (?,?,?,?,?)').run(randomBytes(16).toString('hex'),id,'assistant',JSON.stringify(reply),now);
        access.finish(reservation,true);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      res.json({ id, mode: conversation?.mode || mode, messages:messages(id) });
    } catch(e) {access.finish(reservation,false); res.status(502).json({error:['ai_auth','ai_quota','ai_format','ai_upstream'].includes(e.message)?e.message:'ai_network'}); }
    finally { busy.delete(req.user.id); }
  });
}
