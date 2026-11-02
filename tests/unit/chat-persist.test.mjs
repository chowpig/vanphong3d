import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Chat conversations survive the office's restart. Needs the production build (npm run build): skipped without it.
const root = path.resolve(import.meta.dirname, '../..');
const built = fs.existsSync(path.join(root, '.next', 'BUILD_ID'));

async function start(dir, port) {
  const p = spawn(process.execPath, ['server/index.mjs'], { cwd: root, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production', OFFICE_PORT: String(port), OFFICE_DATA_DIR: dir, CLAUDE_CONFIG_DIR: `${dir}-claude`, OFFICE_USAGE: '0', OFFICE_CI: '0', OFFICE_TRANSLATE: '0', OFFICE_VM_BIND: 'off' } });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return p; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
  p.kill(); throw new Error('the office did not start');
}
const sessionsOf = async (port, key) => {
  const r = await fetch(`http://127.0.0.1:${port}/stream?k=${key}`), rd = r.body.getReader(); let txt = '';
  const until = Date.now() + 6000;
  while (Date.now() < until && !/data: \{"k":"snap".*\n/.test(txt)) { const { value } = await rd.read(); txt += new TextDecoder().decode(value || new Uint8Array()); }
  rd.cancel().catch(() => {});
  return JSON.parse(/data: (\{"k":"snap".*)\n/.exec(txt)[1]).sessions;
};
const kill = (p) => new Promise((r) => { p.on('exit', r); p.kill(); });

test('a Chat conversation is still there after the office restarts, and one that was closed is not', { skip: !built && 'needs npm run build', timeout: 120_000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persist-')); fs.mkdirSync(`${dir}-claude`, { recursive: true });
  const port = 4396;
  let p = await start(dir, port);
  const key = fs.readFileSync(path.join(dir, 'token'), 'utf8').trim();
  const post = (e) => fetch(`http://127.0.0.1:${port}/event`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Office-Key': key, 'X-Office-Source': 'chat' }, body: JSON.stringify(e) });
  const cwd = path.join(os.homedir(), 'Chat', 'Marketing');
  for (const id of ['keep', 'close']) { await post({ hook_event_name: 'SessionStart', session_id: `persist-${id}`, cwd, office_title: `Chat ${id}`, office_project: 'Marketing', source: 'startup' }); await post({ hook_event_name: 'Stop', session_id: `persist-${id}`, cwd, office_title: `Chat ${id}`, office_project: 'Marketing' }); }
  await post({ hook_event_name: 'SessionEnd', session_id: 'persist-close', cwd, reason: 'other' });
  await new Promise((r) => setTimeout(r, 4000));   // (the end drops after 1.5 s; the list is written a moment after)
  let list = await sessionsOf(port, key);
  assert.deepEqual(list.filter((s) => s.src === 'chat').map((s) => s.title), ['Chat keep']);
  await kill(p);
  assert.ok(fs.existsSync(path.join(dir, 'chat-sessions.json')), 'the list was written');
  p = await start(dir, port);
  try {
    list = await sessionsOf(port, key);
    const chats = list.filter((s) => s.src === 'chat');
    assert.deepEqual(chats.map((s) => s.title), ['Chat keep']);
    assert.equal(chats[0].proj, 'Marketing');
    assert.equal(chats[0].status, 'rest');
  } finally { await kill(p); }
});
