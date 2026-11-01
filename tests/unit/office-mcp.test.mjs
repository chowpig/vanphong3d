import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { INSTRUCTIONS, TOOL, createHandler, eventsFor, sidOf } from '../../mcp/office-mcp.mjs';

test('a report becomes hook events: a new conversation starts first, working prompts, done stops, closed ends and can start again', () => {
  const seen = new Set();
  const a = eventsFor({ conversation: 'Tạo file ghi chú.txt', status: 'working', title: 'Tạo file ghi chú', project: 'INFO', note: 'viết file' }, seen);
  assert.deepEqual(a.map((e) => e.hook_event_name), ['SessionStart', 'UserPromptSubmit']);
  assert.equal(a[0].session_id, sidOf(' tạo file ghi chú.txt '), 'the id does not depend on case or spaces around');
  assert.equal(a[1].office_project, 'INFO');
  assert.equal(a[1].office_title, 'Tạo file ghi chú');
  assert.deepEqual(eventsFor({ conversation: 'Tạo file ghi chú.txt', status: 'done' }, seen).map((e) => e.hook_event_name), ['Stop']);
  assert.deepEqual(eventsFor({ conversation: 'Tạo file ghi chú.txt', status: 'closed' }, seen).map((e) => e.hook_event_name), ['SessionEnd']);
  assert.deepEqual(eventsFor({ conversation: 'Tạo file ghi chú.txt', status: 'working' }, seen).map((e) => e.hook_event_name), ['SessionStart', 'UserPromptSubmit']);
  assert.equal(eventsFor({ conversation: '', status: 'working' }, seen), null);
  assert.equal(eventsFor({ conversation: 'x', status: 'sleeping' }, seen), null);
  assert.equal(eventsFor({ conversation: 'x'.repeat(500), status: 'working', title: 'y'.repeat(500) }, new Set())[1].prompt.length, 80);
  assert.notEqual(sidOf('a'), sidOf('b'));
});

test('the MCP handler answers initialize, ping, tools/list and tools/call, and says nothing to notifications', async () => {
  const sent = [], h = createHandler({ post: async (e) => { sent.push(e); return true; } });
  assert.equal((await h({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })).result.protocolVersion, '2025-03-26');
  assert.equal((await h({ jsonrpc: '2.0', id: 11, method: 'initialize', params: {} })).result.instructions, INSTRUCTIONS);
  assert.match(INSTRUCTIONS, /EVERY conversation/);
  assert.equal(await h({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.deepEqual((await h({ jsonrpc: '2.0', id: 2, method: 'ping' })).result, {});
  assert.deepEqual((await h({ jsonrpc: '2.0', id: 3, method: 'tools/list' })).result.tools, [TOOL]);
  const call = await h({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'office_report', arguments: { conversation: 'c', status: 'working' } } });
  assert.equal(call.result.content[0].text, 'ok');
  assert.equal(sent.length, 2);
  assert.equal((await h({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'office_report', arguments: {} } })).result.isError, true);
  assert.equal((await h({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'other', arguments: {} } })).error.code, -32602);
  assert.equal((await h({ jsonrpc: '2.0', id: 7, method: 'nope' })).error.code, -32601);
  const down = createHandler({ post: async () => false });
  assert.match((await down({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'office_report', arguments: { conversation: 'c', status: 'done' } } })).result.content[0].text, /not running/);
});

test('the server over stdio posts to the office with its key and the chat marker', async () => {
  const got = [], srv = http.createServer((req, res) => {
    const b = []; req.on('data', (c) => b.push(c));
    req.on('end', () => { got.push({ url: req.url, key: req.headers['x-office-key'], src: req.headers['x-office-source'], body: JSON.parse(Buffer.concat(b).toString()) }); res.writeHead(204).end(); });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-'));
  fs.writeFileSync(path.join(dir, 'token'), 'k3y');
  const p = spawn(process.execPath, [path.resolve(import.meta.dirname, '../../mcp/office-mcp.mjs')], { env: { ...process.env, OFFICE_URL: `http://127.0.0.1:${srv.address().port}`, OFFICE_DATA_DIR: dir } });
  let out = ''; p.stdout.on('data', (d) => { out += d; });
  p.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
  p.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'office_report', arguments: { conversation: 'chat A', status: 'working', project: 'HỒNG PHÚC' } } })}\n`);
  p.stdin.end();
  await new Promise((r) => p.on('close', r));
  srv.close();
  const lines = out.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[1].result.content[0].text, 'ok');
  assert.deepEqual(got.map((g) => g.body.hook_event_name), ['SessionStart', 'UserPromptSubmit']);
  assert.ok(got.every((g) => g.url === '/event' && g.key === 'k3y' && g.src === 'chat'));
  assert.equal(got[1].body.office_project, 'HỒNG PHÚC');
});
