import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const node = process.execPath;
const children = [
  spawn(node, ['server/server.mjs'], { cwd: root, stdio: 'inherit', env: process.env }),
  spawn(node, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', String(process.env.VITE_PORT || 5173), '--strictPort'], { cwd: root, stdio: 'inherit', env: process.env })
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) if (!child.killed) child.kill(isWin ? undefined : 'SIGTERM'); process.exitCode = code; }
for (const child of children) child.on('exit', code => { if (!stopping && code !== 0) stop(code || 1); });
process.on('SIGINT', () => stop(0)); process.on('SIGTERM', () => stop(0));
