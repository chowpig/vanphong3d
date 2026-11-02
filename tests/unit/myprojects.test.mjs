import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MAX_NAME, MAX_PROJECTS, clean, createMyProjects, norm } from '../../server/myprojects.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'myproj-'));

test('names compare without accents, case or punctuation', () => {
  assert.equal(norm('KẾ TOÁN'), 'ke toan');
  assert.equal(norm('ke-toan'), 'ke toan');
  assert.equal(norm('Phụ_tùng  SỈ'), 'phu tung si');
  assert.equal(norm('Đà Lạt'), 'da lat');
  assert.equal(norm(null), '');
});

test('the list is trimmed, deduplicated, bounded and free of control characters', () => {
  assert.deepEqual(clean(['  INFO ', 'info', 'Kế toán', 'KE TOAN', '', '   ', 5, null]), ['INFO', 'Kế toán', '5']);
  assert.deepEqual(clean('not a list'), []);
  assert.equal(clean(['x'.repeat(500)])[0].length, MAX_NAME);
  assert.equal(clean(Array.from({ length: 100 }, (_, i) => `p${i}`)).length, MAX_PROJECTS);
  assert.equal(clean(['a\u0000b\nc'])[0], 'a b c');
});

test('a session is matched to a listed project by its first clue that names one', () => {
  const d = tmp(), mp = createMyProjects(d);
  assert.equal(mp.match(['ke-toan']), '', 'nothing listed, nothing matched');
  mp.set(['INFO', 'KẾ TOÁN', 'BÁN HÀNG', 'KHO']);
  assert.equal(mp.match([undefined, '', 'ke-toan-site']), '');
  assert.equal(mp.match([undefined, 'ke_toan']), 'KẾ TOÁN');
  assert.equal(mp.match(['unrelated', 'Kho', 'info']), 'KHO', 'the earlier clue wins');
  assert.equal(mp.match([]), '');
});

test('a Chat conversation that cannot say its project is matched by a listed name inside its title', () => {
  const mp = createMyProjects(tmp());
  mp.set(['INFO', 'KẾ TOÁN', 'BÁN', 'BÁN HÀNG']);
  assert.equal(mp.match(['Tìm TV Kế toán 1'], { loose: true }), 'KẾ TOÁN');
  assert.equal(mp.match(['Tìm TV Kế toán 1']), '', 'a session with a folder of its own is only matched exactly');
  assert.equal(mp.match(['báo giá bán hàng tháng 11'], { loose: true }), 'BÁN HÀNG', 'the longest name wins');
  assert.equal(mp.match(['Gọi office_report cho Test AI'], { loose: true }), '');
  assert.equal(mp.match(['informatics'], { loose: true }), '', 'whole words only');
  assert.equal(mp.match([undefined, '', 'INFO: kế hoạch'], { loose: true }), 'INFO');
});

test('the list is kept in the data folder and comes back', () => {
  const d = tmp(); createMyProjects(d).set(['A b', 'C']);
  assert.deepEqual(createMyProjects(d).list(), ['A b', 'C']);
  fs.writeFileSync(path.join(d, 'myprojects.json'), '{not json');
  assert.deepEqual(createMyProjects(d).list(), [], 'a broken file starts empty');
});

test('the Cowork plugin sends every event through its own finder script', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  assert.ok(fs.existsSync(path.join(root, 'cowork-plugin/hooks/cowork-send.mjs')));
  const h = JSON.parse(fs.readFileSync(path.join(root, 'cowork-plugin/hooks/hooks.json'), 'utf8')).hooks;
  const cmds = Object.values(h).flatMap((g) => g.flatMap((x) => x.hooks.map((y) => y.command)));
  assert.ok(cmds.length > 5);
  for (const c of cmds) assert.match(c, /cowork-send\.mjs/);
  assert.ok(h.SessionStart[0].hooks[0].command.includes('--probe'), 'a session starts by saying whether the office was found');
});
