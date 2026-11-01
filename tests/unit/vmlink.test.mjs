import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { onSubnet, vmAddresses, vmHandler } from '../../server/vmlink.mjs';

const ifaces = {
  'Ethernet': [{ family: 'IPv4', address: '192.168.1.10', netmask: '255.255.255.0', internal: false }],
  'vEthernet (WSL)': [{ family: 'IPv6', address: 'fe80::1', netmask: 'ffff::', internal: false }, { family: 'IPv4', address: '169.254.173.253', netmask: '255.255.0.0', internal: false }],
  'VPN18 - VPN Client': [{ family: 'IPv4', address: '169.254.5.81', netmask: '255.255.0.0', internal: false }],
  'Loopback Pseudo-Interface 1': [{ family: 'IPv4', address: '127.0.0.1', netmask: '255.0.0.0', internal: true }],
};

test('only Hyper-V virtual adapters are listened on, only on Windows, and only unless switched off', () => {
  assert.deepEqual(vmAddresses(ifaces, {}, 'win32').map((p) => p.address), ['169.254.173.253']);
  assert.deepEqual(vmAddresses(ifaces, { OFFICE_VM_BIND: 'off' }, 'win32'), []);
  assert.deepEqual(vmAddresses(ifaces, {}, 'darwin'), []);
  assert.deepEqual(vmAddresses(ifaces, {}, 'linux'), []);
  assert.deepEqual(vmAddresses({}, {}, 'win32'), []);
});

test('a caller must be on the adapter\'s own subnet', () => {
  const peer = { address: '169.254.173.253', netmask: '255.255.0.0' };
  assert.equal(onSubnet('169.254.10.2', peer), true);
  assert.equal(onSubnet('::ffff:169.254.10.2', peer), true);
  assert.equal(onSubnet('192.168.1.50', peer), false);
  assert.equal(onSubnet('169.253.0.1', peer), false);
  assert.equal(onSubnet('::1', peer), false);
  assert.equal(onSubnet('', peer), false);
});

// a listener on this computer's loopback (standing in for the adapter) and the plugin's script talking to it
async function withListener(fn, { peer = { address: '127.0.0.1', netmask: '255.0.0.0' }, key = 'k3y' } = {}) {
  const got = [], srv = http.createServer(vmHandler({ peer, keyOk: (k) => k === key, onEvent: (p) => got.push(p) }));
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try { await fn(srv.address().port, got); } finally { srv.close(); srv.closeAllConnections?.(); }
}
const send = (port, args, input, env = {}) => new Promise((resolve) => {
  const dir = path.resolve(import.meta.dirname, '../../cowork-plugin/hooks/cowork-send.mjs');
  const p = spawn(process.execPath, [dir, `http://127.0.0.1:${port}/event`, ...args], { env: { ...process.env, ...env } });
  let out = ''; p.stdout.on('data', (d) => { out += d; }); p.on('close', () => resolve(out)); p.stdin.end(input);
});

test('the listener says ok to /health, takes an event with the key, and refuses everything else', async () => {
  await withListener(async (port, got) => {
    const base = `http://127.0.0.1:${port}`;
    assert.equal(await (await fetch(`${base}/health`)).text(), 'ok');
    assert.equal((await fetch(`${base}/event`, { method: 'POST', body: '{"a":1}' })).status, 403, 'no key');
    assert.equal((await fetch(`${base}/event`, { method: 'POST', headers: { 'X-Office-Key': 'nope' }, body: '{"a":1}' })).status, 403, 'wrong key');
    assert.equal((await fetch(`${base}/event`, { method: 'POST', headers: { 'X-Office-Key': 'k3y' }, body: '{"a":1}' })).status, 204);
    assert.equal((await fetch(`${base}/api/doctor`)).status, 404);
    assert.equal((await fetch(`${base}/hook/permission`, { method: 'POST', headers: { 'X-Office-Key': 'k3y' }, body: '{}' })).status, 404, 'not the approval hooks');
    assert.equal((await fetch(`${base}/event`, { method: 'POST', headers: { 'X-Office-Key': 'k3y' }, body: 'x'.repeat(2_000_000) }).catch(() => ({ status: 413 }))).status, 413);
    assert.deepEqual(got, [{ a: 1 }]);
  });
});

test('a caller off the adapter\'s subnet is refused outright', async () => {
  await withListener(async (port, got) => {
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 403);
    assert.equal((await fetch(`http://127.0.0.1:${port}/event`, { method: 'POST', headers: { 'X-Office-Key': 'k3y' }, body: '{"a":1}' })).status, 403);
    assert.deepEqual(got, []);
  }, { peer: { address: '169.254.173.253', netmask: '255.255.0.0' } });
});

test('the plugin script finds the office, sends the event as Cowork, and says so in the chat when probing', async () => {
  await withListener(async (port, got) => {
    // (the key comes from data/token next to the script's plugin: given by OFFICE_DATA_DIR here)
    const dir = (await import('node:fs')).mkdtempSync(path.join((await import('node:os')).tmpdir(), 'cw-'));
    (await import('node:fs')).writeFileSync(path.join(dir, 'token'), 'k3y');
    await send(port, ['--async'], '{"hook_event_name":"SessionStart","session_id":"x"}', { OFFICE_DATA_DIR: dir });
    assert.deepEqual(got, [{ hook_event_name: 'SessionStart', session_id: 'x' }]);
    const said = JSON.parse(await send(port, ['--probe'], '{}', { OFFICE_DATA_DIR: dir }));
    assert.match(said.systemMessage, /đã kết nối qua 127\.0\.0\.1/);
    assert.equal(got.length, 1, 'probing sends no event');
  });
  // no office at all: no output beyond the probe's own words, and no failure
  const out = JSON.parse(await send(1, ['--probe'], '{}', { OFFICE_DATA_DIR: 'x' }));
  assert.match(out.systemMessage, /không tìm thấy văn phòng/);
});
