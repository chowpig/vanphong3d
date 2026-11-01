#!/usr/bin/env node
// The Cowork plugin's hook: finds the office from inside Cowork's virtual machine and POSTs the hook's JSON to it,
// marked as Cowork. The VM cannot see the computer's 127.0.0.1, so it tries, all at once, the places a VM usually
// reaches its host (the default gateway, the nameserver, host.docker.internal…) and the last one that worked, and uses
// the first that answers GET /health. Never fails the hook: with no office it just exits.
//   node cowork-send.mjs http://127.0.0.1:4310/event            (an event: fire and forget)
//   node cowork-send.mjs http://127.0.0.1:4310/event --probe    (says in the chat whether the office was found)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [url, ...flags] = process.argv.slice(2), probe = flags.includes('--probe');
const port = new URL(url).port || '4310', root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const memo = path.join(os.tmpdir(), 'my-office-host.json');
let key = ''; try { key = fs.readFileSync(path.join(process.env.OFFICE_DATA_DIR || path.join(root, 'data'), 'token'), 'utf8').trim(); } catch { /* no key: the office answers 403 */ }
const chunks = []; for await (const c of process.stdin) chunks.push(c);
const body = Buffer.concat(chunks);

const hexIp = (h) => (/^[0-9A-Fa-f]{8}$/.test(h) ? [6, 4, 2, 0].map((i) => parseInt(h.slice(i, i + 2), 16)).join('.') : null);
function hostsToTry() {
  const out = [];
  try { out.push(JSON.parse(fs.readFileSync(memo, 'utf8')).host); } catch { /* none yet */ }
  if (process.env.OFFICE_HOST_ADDR) out.push(process.env.OFFICE_HOST_ADDR);
  out.push('127.0.0.1');
  try { for (const l of fs.readFileSync('/proc/net/route', 'utf8').split('\n').slice(1)) { const f = l.split(/\s+/); if (f[1] === '00000000') out.push(hexIp(f[2])); } } catch { /* not Linux */ }
  try { for (const m of fs.readFileSync('/etc/resolv.conf', 'utf8').matchAll(/^nameserver\s+(\d+\.\d+\.\d+\.\d+)/gm)) out.push(m[1]); } catch { /* none */ }
  out.push('host.docker.internal', 'host.containers.internal', 'host.lima.internal', 'host.internal');
  return [...new Set(out.filter(Boolean))];
}
const alive = async (host) => {
  try { const r = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(1200) }); if (r.ok && (await r.text()).trim() === 'ok') return host; } catch { /* not there */ }
  throw new Error('no');
};
// (at most 3 seconds, whatever a name lookup does: the hook has a few seconds in all)
const find = (hosts) => Promise.race([Promise.any(hosts.map(alive)).catch(() => null), new Promise((r) => setTimeout(() => r(null), 3000))]);

try {
  const hosts = hostsToTry(), host = await find(hosts);
  if (host) {
    try { fs.writeFileSync(memo, JSON.stringify({ host, at: Date.now() })); } catch { /* read-only: asked again next time */ }
    if (!probe) await fetch(`http://${host}:${port}/event`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Office-Key': key, 'X-Office-Source': 'cowork' }, body, signal: AbortSignal.timeout(2000) }).catch(() => {});
  }
  if (probe) process.stdout.write(JSON.stringify({ systemMessage: host ? `My Office: đã kết nối qua ${host}:${port}${key ? '' : ' (thiếu khóa data/token: văn phòng sẽ từ chối)'}` : `My Office: không tìm thấy văn phòng (đã thử ${hosts.join(', ')}:${port})` }));
} catch { /* the office is closed: Cowork carries on as usual */ }
process.exit(0);   // (a name lookup still running must not keep the hook open)
