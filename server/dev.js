import { spawn } from 'node:child_process';
const children = [spawn(process.execPath, ['--use-env-proxy', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } }), spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' })];
let closing = false;
function stop(code = 0) { if (closing) return; closing = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const child of children) { child.on('error', () => stop(1)); child.on('exit', code => stop(code || 0)); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
