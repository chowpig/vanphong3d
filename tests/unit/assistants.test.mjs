import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ASSISTANTS, classify, createAssistants, isJob, mentioned } from '../../server/assistants.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'asst-'));
const make = (dir = tmp(), claude = () => null) => createAssistants({ dataDir: dir, claude, env: () => ({}) });
const words = Object.fromEntries(ASSISTANTS.map((a) => [a.key, a.words]));

test('a conversation goes to the assistant whose words it holds, else to the personal one', () => {
  assert.equal(classify({ title: 'Lập hóa đơn tháng 10' }, words), 'ketoan');
  assert.equal(classify({ title: 'Chat', project: 'NHÂN SỰ' }, words), 'nhansu');
  assert.equal(classify({ title: 'Bản vẽ nhà xưởng' }, words), 'xaydung');
  assert.equal(classify({ title: 'Mua vé máy bay' }, words), 'troly');
  assert.equal(classify({ title: 'informatics' , project: 'hrm'}, words), 'troly');   // (whole words only)
});

test('who a line in the group is for', () => {
  const names = { ketoan: 'Kế Toán', nhansu: 'Nhân Sự', xaydung: 'Xây Dựng', troly: 'Trợ Lý' };
  assert.deepEqual(mentioned('@Kế Toán tháng này thu bao nhiêu?', names), ['ketoan']);
  assert.deepEqual(mentioned('ke toan va nhan su oi', names), ['ketoan', 'nhansu']);
  assert.deepEqual(mentioned('hôm nay trời đẹp', names), []);
  assert.equal(mentioned('trợ lý, kế toán, nhân sự, xây dựng', names, 2).length, 2);
});

test('a job is told from a question', () => {
  assert.equal(isJob('giao việc: soạn bảng lương'), true);
  assert.equal(isJob('@Kế Toán lập báo cáo thuế giúp em'), true);
  assert.equal(isJob('tháng này còn dự án nào đang chạy?'), false);
});

test('the ledger keeps a conversation after it has gone, and tells running from ended', () => {
  const a = make(), now = Date.now();
  a.touch([{ id: 'c1', title: 'Hóa đơn tháng 10', status: 'work', src: 'chat' }, { id: 'c2', title: 'Quyết toán thuế', status: 'rest', src: 'cowork' }], now);
  assert.deepEqual(a.counts('ketoan'), { running: 1, open: 2, total: 2 });
  a.touch([{ id: 'c2', title: 'Quyết toán thuế', status: 'rest', src: 'cowork' }], now + 1000);   // c1 left
  assert.deepEqual(a.counts('ketoan'), { running: 0, open: 1, total: 2 });
  const text = a.digest('ketoan', now + 3600e3);
  assert.match(text, /đã kết thúc\] "Hóa đơn tháng 10"/);
  assert.match(text, /đang mở, nghỉ\] "Quyết toán thuế"/);
  assert.match(a.digest('nhansu'), /Sổ trống/);
});

test('the ledger and the chats survive a restart', () => {
  const dir = tmp(), a = make(dir);
  a.touch([{ id: 'c1', title: 'Tuyển dụng kỹ sư', status: 'rest' }]);
  a.remember('nhansu', 'me', 'xin chào');
  a.remember('nhansu', 'ai', 'chào sếp');
  return new Promise((r) => setTimeout(r, 1700)).then(() => {
    const b = make(dir);
    assert.equal(b.counts('nhansu').total, 1);
    assert.deepEqual(b.history('nhansu').map((m) => m.t), ['xin chào', 'chào sếp']);
  });
});

test('the words and the folder are the owner\'s to set; a bad folder is refused', () => {
  const dir = tmp(), a = make(dir), work = tmp();
  assert.equal(a.setConfig('ketoan', { words: ['quyết toán', 'quyết toán', ''] }), true);
  assert.deepEqual(a.words().ketoan, ['quyết toán']);
  assert.equal(a.setConfig('ketoan', { dir: work }), true);
  assert.equal(a.dirOf('ketoan'), path.resolve(work));
  assert.equal(a.setConfig('ketoan', { dir: 'relative/path' }), false);
  assert.equal(a.setConfig('ketoan', { dir: path.join(work, 'nope') }), false);
  assert.equal(a.setConfig('nobody', { words: ['x'] }), false);
  assert.equal(a.setConfig('ketoan', { dir: '' }), true);
  assert.equal(a.dirOf('ketoan'), '');
});

test('asking without Claude Code says so; an empty question is refused', async () => {
  const a = make();
  assert.deepEqual(await a.ask({ key: 'ketoan', name: 'Kế Toán', text: 'xin chào' }), { ok: false, code: 'noClaude' });
  assert.deepEqual(await a.ask({ key: 'ketoan', name: 'Kế Toán', text: '  ' }), { ok: false, code: 'empty' });
  assert.deepEqual(await a.ask({ key: 'nobody', name: 'x', text: 'hi' }), { ok: false, code: 'empty' });
});

test('the job words carry the area\'s ledger', () => {
  const a = make(); a.touch([{ id: 'c1', title: 'Hóa đơn', status: 'work' }]);
  assert.match(a.jobSystem('ketoan', 'Kế Toán'), /ĐANG CHẠY\] "Hóa đơn"/);
});
