import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChatEngine } from '../../src/shared/chat-engine.js';
import { createT } from '../../src/i18n/index.js';

// the chat engine with a fake clock, in Vietnamese: what a session says about its work
function office(members) {
  let t = Date.UTC(2026, 10, 2, 3, 0, 0), timers = [];
  const eng = createChatEngine({
    tr: createT('vi'), now: () => t, members: () => members, staffName: () => 'Lễ tân',
    store: { load: () => null, save: () => {} }, emit: () => {}, act: () => {},
    timer: (fn, ms) => { timers.push({ at: t + ms, fn }); return timers.length; },
  });
  const advance = (ms) => { t += ms; const due = timers.filter((x) => x.at <= t); timers = timers.filter((x) => x.at > t); for (const x of due) x.fn(); };
  const said = () => eng.state.msgs.filter((m) => m.kind === 'text' && m.from !== 'me').map((m) => m.text);
  return { eng, advance, said, jump: (ms) => { t += ms; } };
}
const S = (extra = {}) => ({ id: 'a', name: 'Chat · Tìm TV', status: 'work', task: 'so sánh giá tivi 55 inch', project: 'HỒNG PHÚC', counts: { edit: 0, cmd: 0, read: 0, web: 0 }, ...extra });

test('a finished piece of work says what was done: the files changed, the commands run or the sources read, and how long it took', () => {
  const run = (counts, ms) => {
    const m = S({ counts: { edit: 0, cmd: 0, read: 0, web: 0 } }), { eng, advance, said, jump } = office([m]), out = [];
    for (let i = 0; i < 14; i++) {
      m.counts = { edit: 0, cmd: 0, read: 0, web: 0 };
      eng.onEvent({ type: 'prompt', sess: 'a', label: `việc ${i}` }); jump(61_000); advance(3000);
      m.counts = { ...counts }; jump(ms);
      eng.onEvent({ type: 'stop', sess: 'a', label: `việc ${i}` }); advance(8000); out.push(said().at(-1)); jump(5 * 60_000);
    }
    return out;
  };
  const edited = run({ edit: 3, cmd: 2, read: 4, web: 1 }, 185_000);
  assert.ok(edited.every((l) => /3 file/.test(l) && !/[{}]/.test(l)), edited.join('\n'));
  assert.ok(edited.some((l) => /\d+ phút/.test(l)), 'the time it took shows in some');
  const researched = run({ edit: 0, cmd: 0, read: 2, web: 3 }, 40_000);
  assert.ok(researched.every((l) => /5 /.test(l) && !/file/.test(l)), researched.join('\n'));
  assert.ok(researched.some((l) => /\d+ phút/.test(l)));
});

test('a line never shows an unfilled {word}, and one that needs a number is skipped when there is none', () => {
  const m = S(), { eng, advance, said, jump } = office([m]);
  for (let i = 0; i < 12; i++) {
    eng.onEvent({ type: 'prompt', sess: 'a', label: `việc số ${i}` }); jump(61_000); advance(3000);
    eng.onEvent({ type: 'stop', sess: 'a', label: `việc số ${i}` }); jump(5 * 60_000); advance(8000);
  }
  const all = said();
  assert.ok(all.length >= 12);
  for (const l of all) assert.doesNotMatch(l, /[{}]/, l);
  for (const l of all) assert.doesNotMatch(l, /file|lệnh|nguồn/, `nothing was edited, run or read: ${l}`);
});

test('the same line is not said twice in a row, and the lines vary', () => {
  const m = S(), { eng, advance, said, jump } = office([m]);
  for (let i = 0; i < 20; i++) {
    eng.onEvent({ type: 'prompt', sess: 'a', label: 'báo giá' }); jump(61_000); advance(3000);
    jump(5 * 60_000); advance(1000);
  }
  const acks = said().filter((l) => /báo giá/.test(l));
  assert.ok(acks.length >= 15, `${acks.length} acknowledgements`);
  for (let i = 1; i < acks.length; i++) assert.notEqual(acks[i], acks[i - 1], 'no immediate repeat');
  assert.ok(new Set(acks).size >= 5, `${new Set(acks).size} different lines`);
});

test('what is said is about the work: no lunch poll, no tea reminder, no shopping', () => {
  const { eng } = office([S()]);
  eng.clock();
  const text = JSON.stringify(eng.state.msgs);
  assert.doesNotMatch(text, /Mixue|Highlands|Phúc Long|trà sữa|ATM|pickle/i);
  assert.equal(eng.state.msgs.filter((m) => m.kind === 'poll').length, 0);
});
