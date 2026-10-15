import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { extractMaterials } from '../server/sources.js';
test('official material extraction excludes other levels and third-party hosts', () => {
  const source = { id: 'dele', url: 'https://examenes.cervantes.es/es/dele/preparar-prueba' };
  const html = '<a href="/files/DELE_A2.pdf">Modelo A2</a><a href="http://examenes.cervantes.es/files/A2.zip">Audios A2</a><a href="/files/B1.pdf">Modelo B1</a><a href="https://evil.example/A2.pdf">Bad</a><a href="javascript:alert(1)">Bad</a>';
  const links = extractMaterials(html, source);
  assert.equal(links.length, 2); assert.ok(links.every(l => l.url.startsWith('https://examenes.cervantes.es/')));
});
test('daily monitor updates links, flags new editions and retains the last good state on failure', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'rumbo-sources-'));
  let edition = 2026, offline = false;
  const runtime = createApp({ dataDir, sourceFetch: async () => { if (offline) throw new Error('offline'); return new Response(`<a href="/files/CCSE_A2_${edition}.pdf">Manual ${edition}</a>`, { headers: { 'content-type': 'text/html' } }); } });
  try {
    await runtime.checkSources();
    let row = runtime.db.prepare("SELECT * FROM sources WHERE id='ccse'").get();
    assert.ok(row.verified_at); assert.equal(row.changed_at, null); assert.ok(row.materials.includes('2026'));
    edition = 2027; await runtime.checkSources();
    row = runtime.db.prepare("SELECT * FROM sources WHERE id='ccse'").get();
    assert.ok(row.changed_at); assert.ok(row.materials.includes('2027')); assert.equal(row.error, null);
    offline = true; await runtime.checkSources();
    const failed = runtime.db.prepare("SELECT * FROM sources WHERE id='ccse'").get();
    assert.equal(failed.error, 'network_unavailable'); assert.equal(failed.materials, row.materials); assert.equal(failed.verified_at, row.verified_at);
  } finally { runtime.db.close(); rmSync(dataDir, { recursive: true, force: true }); }
});
