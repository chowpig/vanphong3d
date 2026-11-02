import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { configCandidates, makeZip, mcpEntry, pluginFiles, withMcp } from '../../bin/chat-setup.mjs';

const root = path.resolve(import.meta.dirname, '../..');

test('the Claude app config file is looked for where each system keeps it, the store build included', () => {
  const win = configCandidates({ platform: 'win32', env: { APPDATA: 'C:\\U\\AppData\\Roaming', LOCALAPPDATA: 'C:\\U\\AppData\\Local' }, readdir: (d) => (/Claude-Data$/.test(d) ? ['claude_abc'] : /Packages$/.test(d) ? ['Claude_abc', 'Other_x'] : []) });
  assert.equal(win.length, 3);
  assert.ok(win[0].includes('Roaming') && win[0].endsWith('claude_desktop_config.json'));
  assert.ok(win.some((f) => f.includes('Claude-Data') && f.includes('claude_abc')));
  assert.ok(win.some((f) => f.includes('Packages') && f.includes('Claude_abc') && f.includes('LocalCache')));
  assert.ok(!win.some((f) => f.includes('Other_x')));
  assert.deepEqual(configCandidates({ platform: 'darwin', home: '/Users/a' }), [path.join('/Users/a', 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')]);
  assert.deepEqual(configCandidates({ platform: 'linux', home: '/home/a', env: {} }), [path.join('/home/a', '.config', 'Claude', 'claude_desktop_config.json')]);
  assert.deepEqual(configCandidates({ platform: 'win32', env: {} }), []);
});

test('the tool of the office is added to the config and nothing else changes', () => {
  const entry = mcpEntry('/usr/bin/node', '/opt/office');
  assert.deepEqual(entry, { command: '/usr/bin/node', args: [path.join('/opt/office', 'mcp', 'office-mcp.mjs')] });
  const before = { preferences: { a: 1 }, mcpServers: { other: { command: 'x' } } };
  const after = withMcp(before, entry);
  assert.deepEqual(after.preferences, { a: 1 });
  assert.deepEqual(Object.keys(after.mcpServers).sort(), ['my-office', 'other']);
  assert.deepEqual(before.mcpServers, { other: { command: 'x' } }, 'the original is not changed');
  assert.deepEqual(withMcp({}, entry).mcpServers['my-office'], entry);
  assert.deepEqual(withMcp(withMcp({}, entry), entry), withMcp({}, entry), 'adding twice is the same as once');
  assert.throws(() => withMcp([], entry));
  assert.throws(() => withMcp({ mcpServers: [] }, entry));
});

// a small zip reader, to check the archive is what other tools will read
function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), n = buf.readUInt16LE(eocd + 10), out = {};
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nl).toString('utf8'), lh = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const data = method === 8 ? zlib.inflateRawSync(buf.subarray(lh, lh + csize)) : buf.subarray(lh, lh + csize);
    assert.equal(data.length, size);
    if (zlib.crc32) assert.equal(zlib.crc32(data), crc);
    out[name] = data;
    p += 46 + nl + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

test('the archive reads back: names with forward slashes, hidden folders, UTF-8, the same bytes', () => {
  const files = [{ name: '.claude-plugin/plugin.json', data: Buffer.from('{"name":"x"}') }, { name: 'hooks\\hooks.json', data: Buffer.from('{"hooks":{}}') }, { name: 'đọc-tôi.md', data: Buffer.from('Tiếng Việt ✓'.repeat(50)) }, { name: 'empty.txt', data: Buffer.alloc(0) }];
  const got = unzip(makeZip(files));
  assert.deepEqual(Object.keys(got), ['.claude-plugin/plugin.json', 'hooks/hooks.json', 'đọc-tôi.md', 'empty.txt']);
  assert.equal(got['.claude-plugin/plugin.json'].toString(), '{"name":"x"}');
  assert.equal(got['đọc-tôi.md'].toString(), 'Tiếng Việt ✓'.repeat(50));
  assert.equal(got['empty.txt'].length, 0);
  assert.deepEqual(makeZip(files), makeZip(files), 'the same files make the same archive');
});

test('the Cowork plugin package: its files, the key, and nothing from a data folder', () => {
  const files = pluginFiles(root, ' k3y \n'), names = files.map((f) => f.name);
  assert.ok(names.includes('.claude-plugin/plugin.json') && names.includes('hooks/hooks.json') && names.includes('hooks/cowork-send.mjs'));
  assert.equal(files.find((f) => f.name === 'data/token').data.toString(), 'k3y');
  assert.equal(names.filter((n) => n.startsWith('data/')).length, 1, 'only the key: whatever sits in cowork-plugin/data is left out');
  const zip = unzip(makeZip(pluginFiles(root, 'k3y')));
  assert.ok(JSON.parse(zip['.claude-plugin/plugin.json'].toString()).name);
});

test('chat-setup prints the entry, adds it with --write after a backup, and is safe to run twice', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
  // (where this system keeps the file, with every place the app might otherwise be found pointed into the temp folder)
  const cfgDir = process.platform === 'win32' ? path.join(home, 'Roaming', 'Claude') : process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support', 'Claude') : path.join(home, '.config', 'Claude'), file = path.join(cfgDir, 'claude_desktop_config.json');
  const env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'Roaming'), LOCALAPPDATA: path.join(home, 'Local'), XDG_CONFIG_HOME: path.join(home, '.config'), OFFICE_DATA_DIR: path.join(home, 'data'), OFFICE_LANG: 'en' };
  const run = (...a) => spawnSync(process.execPath, [path.join(root, 'bin', 'cli.mjs'), 'chat-setup', ...a], { env, encoding: 'utf8' });
  let r = run();
  assert.notEqual(r.status, 0, 'no app, no config: it says so');
  assert.match(r.stdout, /Could not find/);
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ preferences: { keep: true } }));
  r = run();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /"my-office"/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { preferences: { keep: true } }, 'printing changes nothing');
  r = run('--write');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(cfg.preferences.keep, true);
  assert.equal(cfg.mcpServers['my-office'].command, process.execPath);
  assert.equal(fs.readdirSync(cfgDir).filter((f) => f.includes('.bak-office-')).length, 1, 'a backup');
  fs.writeFileSync(file, '{not json');
  r = run('--write');
  assert.notEqual(r.status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), '{not json', 'a broken file is left alone');
});
