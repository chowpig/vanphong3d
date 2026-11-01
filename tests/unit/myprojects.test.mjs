import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MAX_NAME, MAX_PROJECTS, clean, createMyProjects, norm } from '../../server/myprojects.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'myproj-'));

test('names compare without accents, case or punctuation', () => {
  assert.equal(norm('HỒNG PHÚC'), 'hong phuc');
  assert.equal(norm('hong-phuc'), 'hong phuc');
  assert.equal(norm('Phụ_tùng  SỈ'), 'phu tung si');
  assert.equal(norm('Đà Lạt'), 'da lat');
  assert.equal(norm(null), '');
});

test('the list is trimmed, deduplicated, bounded and free of control characters', () => {
  assert.deepEqual(clean(['  INFO ', 'info', 'Hồng Phúc', 'HONG PHUC', '', '   ', 5, null]), ['INFO', 'Hồng Phúc', '5']);
  assert.deepEqual(clean('not a list'), []);
  assert.equal(clean(['x'.repeat(500)])[0].length, MAX_NAME);
  assert.equal(clean(Array.from({ length: 100 }, (_, i) => `p${i}`)).length, MAX_PROJECTS);
  assert.equal(clean(['a\u0000b\nc'])[0], 'a b c');
});

test('a session is matched to a listed project by its first clue that names one', () => {
  const d = tmp(), mp = createMyProjects(d);
  assert.equal(mp.match(['hong-phuc']), '', 'nothing listed, nothing matched');
  mp.set(['INFO', 'HỒNG PHÚC', 'PHỤ TÙNG SỈ', 'NHÀ GỖ']);
  assert.equal(mp.match([undefined, '', 'hong-phuc-site']), '');
  assert.equal(mp.match([undefined, 'hong_phuc']), 'HỒNG PHÚC');
  assert.equal(mp.match(['unrelated', 'Nha Go', 'info']), 'NHÀ GỖ', 'the earlier clue wins');
  assert.equal(mp.match([]), '');
});

test('the list is kept in the data folder and comes back', () => {
  const d = tmp(); createMyProjects(d).set(['A b', 'C']);
  assert.deepEqual(createMyProjects(d).list(), ['A b', 'C']);
  fs.writeFileSync(path.join(d, 'myprojects.json'), '{not json');
  assert.deepEqual(createMyProjects(d).list(), [], 'a broken file starts empty');
});

test('the Cowork plugin carries the same hook script as Claude Code, and marks its events', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  assert.equal(fs.readFileSync(path.join(root, 'cowork-plugin/hooks/send.mjs'), 'utf8'), fs.readFileSync(path.join(root, 'hooks/send.mjs'), 'utf8'));
  const h = JSON.parse(fs.readFileSync(path.join(root, 'cowork-plugin/hooks/hooks.json'), 'utf8')).hooks;
  const cmds = Object.values(h).flatMap((g) => g.flatMap((x) => x.hooks.map((y) => y.command)));
  assert.ok(cmds.length > 5);
  for (const c of cmds) assert.match(c, /--source cowork/);
});
