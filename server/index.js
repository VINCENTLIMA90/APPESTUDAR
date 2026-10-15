import { createApp } from './app.js';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { app, checkSources } = createApp({ dataDir: process.env.DATA_DIR || path.join(root, '.data') });
if (existsSync(path.join(root, 'dist/index.html'))) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
}
const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '0.0.0.0', () => console.log('Rumbo server ready on port ' + server.address().port));
const refresh = () => checkSources().catch(() => console.error('Source check failed'));
refresh();
const timer = setInterval(refresh, 24 * 3600000);
timer.unref();
process.on('SIGTERM', () => { clearInterval(timer); server.close(); });
