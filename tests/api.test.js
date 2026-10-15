import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {grantPlan,testAIConfig} from './helpers.js';
import { createApp } from '../server/app.js';
import { questions, lessons } from '../server/content.js';

let server, runtime, base;
const dataDir = mkdtempSync(path.join(tmpdir(), 'rumbo-test-'));
before(async () => {
  runtime = createApp({ dataDir, secure: false, aiConfig:testAIConfig, ai: async args => {
    assert.equal(args.key, 'test-key-never-store');
    return { summary: 'Resposta clara.', strengths: ['Boa estrutura'], improvements: ['Rever os verbos'], corrected: 'Hola, amigo.', nextStep: 'Praticar o passado.', provider: args.provider, model: 'test', evaluatedAt: new Date().toISOString() };
  } });
  server = await new Promise(resolve => { const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { await new Promise(resolve => server.close(resolve)); runtime.db.close(); rmSync(dataDir, { recursive: true, force: true }); });
async function request(route, { body, method, cookie, headers = {} } = {}) {
  const response = await fetch(base + '/api' + route, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.arrayBuffer(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
async function register(email = 'alice@example.test') {const result=await request('/auth/register', { body: { name: 'Alice', email, password: 'a-strong-test-password', language: 'pt-PT' } });grantPlan(runtime.db,result.data.user.id);return result;}
test('catalog exposes lessons and tasks, without answer bank or solutions', async () => {
  const response = await request('/catalog');
  assert.equal(response.status, 200); assert.equal(response.data.lessons.length, lessons.length); assert.equal(response.data.languages.length, 7);
  assert.equal(response.data.questions, undefined); assert.deepEqual(response.data.tasks,{});
});
test('auth stores a salted password, restores sessions and rejects cross-site requests', async () => {
  const account = await register();
  assert.equal(account.status, 201); assert.ok(account.headers.get('set-cookie').includes('HttpOnly')); assert.ok(account.headers.get('set-cookie').includes('SameSite=Lax'));
  const record = runtime.db.prepare('SELECT * FROM users WHERE id=?').get(account.data.user.id);
  assert.notEqual(record.password, 'a-strong-test-password'); assert.equal(record.password.length, 128);
  assert.equal((await request('/me', { cookie: account.cookie })).data.user.name, 'Alice');
  assert.equal((await request('/auth/login', { body: { email: 'alice@example.test', password: 'wrong' } })).status, 401);
  const login = await request('/auth/login', { body: { email: 'alice@example.test', password: 'a-strong-test-password' } });
  assert.equal(login.status, 200);
  assert.equal((await request('/auth/logout', { body: {}, cookie: login.cookie, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/auth/logout', { body: {}, cookie: login.cookie })).status, 200);
  assert.equal((await request('/me', { cookie: login.cookie })).data.user, null);
  assert.equal((await request('/auth/register', { body: { name: 'A', email: 'x@test.com', password: 'short' } })).status, 400);
});
test('lesson completion is idempotent and isolated per account', async () => {
  const alice = await register('lesson-a@example.test'), bob = await register('lesson-b@example.test');
  assert.equal((await request('/lessons/c1/complete', { body: {} })).status, 401);
  await request('/lessons/c1/complete', { cookie: alice.cookie, body: {} });
  await request('/lessons/c1/complete', { cookie: alice.cookie, body: {} });
  const a = await request('/progress', { cookie: alice.cookie }), b = await request('/progress', { cookie: bob.cookie });
  assert.equal(a.data.completed.length, 1); assert.equal(a.data.streak, 1); assert.equal(b.data.completed.length, 0);
});
test('CCSE simulation has 25 unique questions, 45 minutes, and is graded on server', async () => {
  const account = await register('quiz@example.test');
  const quiz = (await request('/quizzes', { cookie: account.cookie, body: { module: 'ccse', mode: 'simulation' } })).data;
  assert.equal(quiz.minutes, 45); assert.equal(quiz.questions.length, 25); assert.equal(new Set(quiz.questions.map(q => q.id)).size, 25);
  assert.equal(quiz.questions.filter(q => q.category === 'society').length, 7); assert.equal(quiz.questions.filter(q => q.category === 'culture').length, 3); assert.equal(quiz.questions.filter(q => q.category === 'geography').length, 2);
  assert.equal(quiz.questions.filter(q => q.options.length === 2).length, 3); assert.equal(quiz.questions.filter(q => q.category === 'government' && q.options.length === 3).length, 10);
  assert.ok(quiz.questions.every(q => q.correct === undefined && q.explanation === undefined));
  const answers = quiz.questions.map(q => questions.find(original => q.id === original.id).correct);
  const submitted = (await request('/quizzes/' + quiz.id + '/submit', { cookie: account.cookie, body: { answers } })).data;
  assert.equal(submitted.score, 25); assert.equal(submitted.percent, 100);
  const repeated = await request('/quizzes/' + quiz.id + '/submit', { cookie: account.cookie, body: { answers: answers.map(() => null) } });
  assert.equal(repeated.data.score, 25);
});
test('assessment covers listening, reading and civic knowledge; DELE practice balances skills', async () => {
  const account = await register('assessment@example.test');
  const quiz = (await request('/quizzes', { cookie: account.cookie, body: { module: 'dele', mode: 'assessment' } })).data;
  assert.equal(quiz.questions.length, 12); assert.equal(quiz.questions.filter(q => q.category === 'reading').length, 4); assert.equal(quiz.questions.filter(q => q.category === 'listening' && q.audio).length, 4); assert.equal(quiz.questions.filter(q => q.module === 'ccse').length, 4);
  const mock = (await request('/quizzes', { cookie: account.cookie, body: { module: 'dele', mode: 'simulation' } })).data;
  assert.equal(mock.questions.length, 16); assert.equal(mock.questions.filter(q => q.category === 'listening').length, 8);
});
test('review includes mistakes and removes questions after a correct later response', async () => {
  const account = await register('review@example.test');
  assert.equal((await request('/quizzes', { cookie: account.cookie, body: { module: 'ccse', mode: 'review' } })).data.error, 'no_errors');
  const quiz = (await request('/quizzes', { cookie: account.cookie, body: { module: 'ccse', mode: 'practice' } })).data;
  await request('/quizzes/' + quiz.id + '/submit', { cookie: account.cookie, body: { answers: quiz.questions.map(() => null) } });
  const review = (await request('/quizzes', { cookie: account.cookie, body: { module: 'ccse', mode: 'review' } })).data;
  assert.deepEqual(new Set(review.questions.map(q => q.id)), new Set(quiz.questions.map(q => q.id)));
  await request('/quizzes/' + review.id + '/submit', { cookie: account.cookie, body: { answers: review.questions.map(q => questions.find(original => original.id === q.id).correct) } });
  assert.equal((await request('/quizzes', { cookie: account.cookie, body: { module: 'ccse', mode: 'review' } })).data.error, 'no_errors');
});
test('quiz ownership and invalid answers are enforced', async () => {
  const alice = await register('owner-a@example.test'), bob = await register('owner-b@example.test');
  const quiz = (await request('/quizzes', { cookie: alice.cookie, body: { module: 'ccse', mode: 'practice' } })).data;
  assert.equal((await request('/quizzes/' + quiz.id + '/submit', { cookie: bob.cookie, body: { answers: [] } })).status, 404);
  assert.equal((await request('/quizzes/' + quiz.id + '/submit', { cookie: alice.cookie, body: { answers: [] } })).status, 400);
});
test('writing, audio and AI feedback persist, but API keys do not', async () => {
  const account = await register('skill@example.test'), other = await register('skill-other@example.test');
  const submission = await request('/submissions', { cookie: account.cookie, body: { kind: 'speaking', text: 'Me llamo Ana.', audio: Buffer.from('fake-audio-for-storage-test').toString('base64'), mime: 'audio/webm;codecs=opus', rubric: [0, 1] } });
  assert.equal(submission.status, 201);
  const audio = await request('/submissions/' + submission.data.id + '/audio', { cookie: account.cookie });
  assert.equal(Buffer.from(audio.data).toString(), 'fake-audio-for-storage-test');
  assert.equal((await request('/submissions/' + submission.data.id + '/audio', { cookie: other.cookie })).status, 404);
  assert.equal((await request('/submissions/' + submission.data.id + '/evaluate', { cookie: other.cookie, body: {consent:true} })).status, 404);
  const evaluated = await request('/submissions/' + submission.data.id + '/evaluate', { cookie: account.cookie, body: {consent:true} });
  assert.equal(evaluated.status, 200); assert.equal(evaluated.data.summary, 'Resposta clara.');
  const progress = (await request('/progress', { cookie: account.cookie })).data;
  assert.equal(progress.submissions[0].feedback.provider, 'openai'); assert.ok(progress.submissions[0].audio_bytes > 0);
  const exported = (await request('/export', { cookie: account.cookie })).data;
  assert.equal(JSON.stringify(exported).includes('test-key-never-store'), false);
  assert.equal(exported.user.password, undefined); assert.ok(exported.submissions[0].audio);
  assert.equal((await request('/submissions', { cookie: account.cookie, body: { kind: 'speaking', audio: 'invalid payload', mime: 'text/html' } })).status, 400);
});
test('deleting an account removes all its data and sessions', async () => {
  const account = await register('delete@example.test');
  await request('/lessons/d1/complete', { cookie: account.cookie, body: {} });
  await request('/submissions', { cookie: account.cookie, body: { kind: 'writing', text: 'Hola, amigo.', rubric: [] } });
  assert.equal((await request('/me', { cookie: account.cookie, body: {}, method: 'DELETE' })).status, 200);
  for (const table of ['users', 'completions', 'sessions', 'submissions', 'quizzes']) assert.equal(runtime.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${table === 'users' ? 'id' : 'user_id'}=?`).get(account.data.user.id).count, 0);
  assert.equal((await request('/progress', { cookie: account.cookie })).status, 401);
});
test('source status starts unverified and never claims bank freshness from configuration', async () => {
  const sources = (await request('/sources')).data.sources;
  assert.equal(sources.length, 3); assert.ok(sources.every(s => s.verified_at === null && s.fingerprint === null));
});
