import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAI } from '../server/ai.js';
const result = { summary: 'Feedback', strengths: ['Good'], improvements: ['Verbs'], corrected: 'Hola.', nextStep: 'Practise.' };
for (const provider of ['openai', 'anthropic', 'gemini']) test(`${provider} uses its own API protocol and returns structured feedback`, async () => {
  let call;
  const feedback = await evaluateAI({ provider, key: 'test-api-key', kind: 'writing', text: 'Hola.', language: 'pt-PT', task: 'Write a message.' }, async (url, options) => {
    call = { url, options, data: JSON.parse(options.body) };
    if (provider === 'openai') return { choices: [{ message: { content: JSON.stringify(result) } }] };
    if (provider === 'anthropic') return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    return { candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] };
  });
  assert.equal(feedback.summary, 'Feedback'); assert.equal(feedback.provider, provider);
  assert.ok(call.url.startsWith('https://')); assert.ok(!call.url.includes('test-api-key'));
  assert.ok(JSON.stringify(call.data).includes('pt-PT')); assert.ok(JSON.stringify(call.data).includes('Hola.'));
});
test('OpenAI transcribes audio before evaluating and Gemini accepts inline audio', async () => {
  const calls = [];
  const feedback = await evaluateAI({ provider: 'openai', key: 'test-api-key', kind: 'speaking', audio: 'YWJj', mime: 'audio/webm', text: '', task: 'Introduce yourself.', language: 'en' }, async (url, options) => {
    calls.push(url);
    if (url.includes('transcriptions')) { assert.ok(options.body instanceof FormData); return { text: 'Me llamo Alex.' }; }
    return { choices: [{ message: { content: JSON.stringify(result) } }] };
  });
  assert.equal(calls.length, 2); assert.equal(feedback.transcript, 'Me llamo Alex.');
  await evaluateAI({ provider: 'gemini', key: 'test-api-key', kind: 'speaking', audio: 'YWJj', mime: 'audio/mp4', text: '', task: 'Introduce yourself.' }, async (_url, options) => {
    assert.equal(JSON.parse(options.body).contents[0].parts[1].inlineData.mimeType, 'audio/mp4');
    return { candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] };
  });
});
test('Claude requires a transcript and malformed model output is rejected', async () => {
  await assert.rejects(() => evaluateAI({ provider: 'anthropic', key: 'test-api-key', kind: 'speaking', audio: 'YWJj', text: '', task: 'Talk.' }), /ai_text/);
  await assert.rejects(() => evaluateAI({ provider: 'openai', key: 'test-api-key', kind: 'writing', text: 'Hola.', task: 'Write.' }, async () => ({ choices: [{ message: { content: '<not-json>' } }] })), /ai_format/);
});
