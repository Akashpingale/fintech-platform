/**
 * Starts the json-server mock API and the Angular dev server together.
 *
 * Replaces the shell-specific `npm run mock-api & ng serve` chain, which does
 * not work in PowerShell or cmd. Run with `npm run dev`; Ctrl+C stops both.
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const children = [];

function start(label, args) {
  const child = spawn(npx, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  const print = stream => data => {
    for (const line of String(data).split(/\r?\n/)) {
      if (line.trim()) stream.write(`[${label}] ${line}\n`);
    }
  };
  child.stdout.on('data', print(process.stdout));
  child.stderr.on('data', print(process.stderr));

  child.on('exit', code => {
    process.stdout.write(`[${label}] exited with code ${code}\n`);
    shutdown(code ?? 0);
  });

  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('api', ['json-server', 'db.json', '--port', '3000']);
start('web', ['ng', 'serve']);

process.stdout.write(
  'FinTrack dev servers starting — app on http://localhost:4200, mock API on http://localhost:3000\n'
);
