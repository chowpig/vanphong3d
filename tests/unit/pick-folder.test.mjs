import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createPicker, dialogFor } from '../../server/pick-folder.mjs';

const fake = (out, delay = 0) => () => {
  const p = new EventEmitter(); p.stdout = new EventEmitter(); p.kill = () => {};
  setTimeout(() => { if (out) p.stdout.emit('data', out); p.emit('exit', 0); }, delay);
  return p;
};

test('each platform has its own dialog; none is a shell string with the title in it', () => {
  assert.equal(dialogFor('win32')[0], 'powershell.exe');
  assert.equal(dialogFor('darwin')[0], 'osascript');
  assert.equal(dialogFor('linux')[0], 'zenity');
  assert.ok(!dialogFor('darwin', 'a"b\\c')[1][1].includes('a"b'));
});

test('a chosen folder comes back as its path, a closed dialog as cancelled', async () => {
  assert.deepEqual(await createPicker({ platform: 'win32', spawn: fake('D:\\CongTy\\KeToan\r\n') })(), { ok: true, path: 'D:\\CongTy\\KeToan' });
  assert.deepEqual(await createPicker({ platform: 'linux', spawn: fake('') })(), { ok: false, code: 'cancelled' });
});

test('a drive root keeps its backslash', async () => {
  assert.deepEqual(await createPicker({ platform: 'win32', spawn: fake('D:\\') })(), { ok: true, path: 'D:\\' });
});

test('one dialog at a time; a missing program is "unsupported"', async () => {
  const pick = createPicker({ platform: 'win32', spawn: fake('C:\\x', 30) });
  const a = pick(), b = await pick();
  assert.deepEqual(b, { ok: false, code: 'busy' });
  assert.equal((await a).ok, true);
  const bad = createPicker({ platform: 'linux', spawn: () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); setTimeout(() => p.emit('error', new Error('ENOENT')), 0); return p; } });
  assert.deepEqual(await bad(), { ok: false, code: 'unsupported' });
});
