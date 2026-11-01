// The company group chat's engine, the same for the server (server/index.mjs: one conversation for every page, the Mac's
// and a phone's, kept in data/chat.json) and for the online demo (src/office/ui/group-chat.js, kept in the browser).
// It knows nothing of files, pages or the 3D office: what it needs comes in ctx.
//
// People type for a moment before a line shows (emit 'typing'), react and answer each other, vote in polls, say yes
// or no to a reminder, and answer you: @ someone and they say what they're on; "họp" / "meeting" rings the bell,
// "trà sữa" / "milk tea" brings the Friday tea out (ctx.act). What the sessions say about their work comes from the
// hooks' events (onEvent); the office's life (a parcel, the tea, a birthday…) is told by the page where it happens,
// as a finished line (say, with a key so two pages telling the same moment make one message).
//
// ctx: tr (the office's words), now() (ms), members() -> [{ id, name, status, task, last }], staffName(key) -> name or
// null, store { load() -> data | null, save(data) }, emit(op, payload) with op 'add' | 'update' | 'typing' | 'all',
// act(what) for 'meeting' | 'tea', timer(fn, ms).
const MAX = 300, PHOTOS = 6, KEYS = 600;
export const REACTIONS = ['❤️', '👍', '😆', '😮', '😭', '😡'];
const STAFF = { reception: '__reception', hr: '__hr', cleaner: '__cleaner', guard: '__guard', director: '__director', courier: '__courier', accountant: '__accountant', claude: '__claude' };
const KINDS = new Set(['text', 'sticker', 'photo', 'poll', 'remind', 'sys', 'work', 'loop']);   // (work: Claude at work on what you sent it, a live card; loop: a session stuck in a loop, server/loops.mjs)
const short = (s, n = 60) => { s = String(s ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
/** how many steps a session did since a snapshot of its counts: { edit, cmd, read, web } */
const since = (now, then) => Object.fromEntries(['edit', 'cmd', 'read', 'web'].map((k) => [k, Math.max(0, (Number(now?.[k]) || 0) - (Number(then?.[k]) || 0))]));

export function createChatEngine(ctx) {
  const { tr } = ctx, timer = ctx.timer || ((fn, ms) => setTimeout(fn, ms));
  const st = { msgs: [], pinned: null, days: {}, keys: [], typing: [] };
  const queue = [], cool = new Map(), busy = new Map();   // (busy: who is working on what you sent them, key -> name)
  const recent = new Map(), started = new Map();   // (recent: the lines lately said from a list; started: a session's counts and time when its task began)
  /** A line from the list chat.<group>.<key>: not one of the last few said from it, and only one whose {words} are all known
   *  (a line about the files changed is skipped when none were), with the words filled in. */
  function line(group, key, vars = {}) {
    const all = tr(`chat.${group}.${key}`, null, 'list').map(String);
    const known = (l) => [...l.matchAll(/\{(\w+)\}/g)].every(([, k]) => vars[k] !== undefined && vars[k] !== null && vars[k] !== '');
    let pool = all.filter(known); if (!pool.length) pool = all.filter((l) => !l.includes('{')); if (!pool.length) return '';
    const mem = `${group}.${key}`, seen = recent.get(mem) || [], fresh = pool.filter((l) => !seen.includes(l)), l = pickOne(fresh.length ? fresh : pool);
    recent.set(mem, [...seen, l].slice(-Math.max(1, Math.min(4, pool.length - 1))));
    return l.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  }
  /** "3 phút", "45 giây", "1 giờ 5 phút" */
  function took(ms) {
    const sec = Math.max(1, Math.round(ms / 1000));
    if (sec < 60) return tr('chat.dur.s', { n: sec });
    const min = Math.round(sec / 60);
    return min < 60 ? tr('chat.dur.m', { n: min }) : tr('chat.dur.h', { h: Math.floor(min / 60), m: min % 60 });
  }
  let seq = 0, tickT = null;
  const nid = () => `${ctx.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  /* ---------- the store ---------- */
  const data = ctx.store.load();
  if (data?.v === 1 && Array.isArray(data.msgs)) Object.assign(st, { msgs: data.msgs, pinned: data.pinned || null, days: data.days || {}, keys: data.keys || [] });
  function save() {
    let photos = 0;
    const msgs = st.msgs.slice(-MAX).reverse().map((m) => (m.photo && ++photos > PHOTOS ? { ...m, photo: null } : m)).reverse();
    ctx.store.save({ v: 1, msgs, pinned: st.pinned, days: st.days, keys: st.keys.slice(-KEYS) });
  }
  if (!st.msgs.length) add({ kind: 'sys', text: tr('chat.sys.created') });

  /* ---------- who ---------- */
  const members = () => ctx.members();
  function who(from) {
    if (from === 'me') return { key: 'me', name: tr('chat.boss') };
    const key = STAFF[from] || String(from || '');
    if (key.startsWith('__')) { const name = ctx.staffName(key); return name ? { key, name, staff: true } : null; }
    const m = members().find((x) => x.id === key);
    return m ? { key, name: m.name } : null;
  }
  const resting = () => members().filter((m) => m.status === 'rest').map((m) => m.id);
  const anyone = (but = []) => { const r = resting().filter((id) => !but.includes(id)); const pool = r.length ? r : members().map((m) => m.id).filter((id) => !but.includes(id)); return pool.length ? pickOne(pool) : null; };
  const some = (n, but = []) => members().map((m) => m.id).filter((id) => !but.includes(id)).sort(() => Math.random() - 0.5).slice(0, n);

  /* ---------- messages ---------- */
  function add(m) {
    m = { id: nid(), at: ctx.now(), reacts: {}, ...m };
    if (!KINDS.has(m.kind)) m.kind = 'text';
    st.msgs.push(m); if (st.msgs.length > MAX + 30) st.msgs.splice(0, st.msgs.length - MAX);
    save(); ctx.emit('add', m);
    return m;
  }
  const update = (m) => { save(); ctx.emit('update', m); };
  const byId = (id) => st.msgs.find((m) => m.id === id);
  const fresh = (key) => { if (!key) return true; if (st.keys.includes(key)) return false; st.keys.push(key); if (st.keys.length > KEYS + 50) st.keys.splice(0, st.keys.length - KEYS); return true; };
  function system(text) { return add({ kind: 'sys', text }); }
  /** Someone says something after typing a moment (opts.now: at once). opts: delay, sticker, photo, poll, remind, reply
   *  ({ id, name, text }), react (emojis others may add), reacts (how many at most), answer ([{ key, chance, vars }]: lines
   *  others answer with, under chat.reply), pin, key (once only), long (up to 4000 characters: Claude's own answer), tag ('claude': Claude's answer), then(m). */
  function say(from, text, opts = {}) {
    if (!fresh(opts.key) || (!text && opts.sticker == null && !opts.photo && !opts.poll && !opts.remind)) return;
    const p = who(from); if (!p) return;
    const now = ctx.now(), wait = opts.now ? 0 : opts.delay ?? rand(400, 1800), typing = opts.now || p.key === 'me' ? 0 : Math.min(2800, 700 + String(text || '').length * 30);
    queue.push({ p, text: String(text || '').slice(0, opts.long ? 4000 : 600), opts, typeAt: now + wait, at: now + wait + typing });
    queue.sort((a, b) => a.at - b.at);
    tick();
  }
  function tick() {
    clearTimeout(tickT);
    const now = ctx.now();
    while (queue.length && queue[0].at <= now) {
      const { p, text, opts } = queue.shift();
      const kind = opts.poll ? 'poll' : opts.remind ? 'remind' : opts.photo ? 'photo' : opts.sticker != null ? 'sticker' : 'text';
      const m = add({ from: p.key, name: p.name, kind, text, sticker: opts.sticker ?? null, photo: opts.photo || null, poll: opts.poll || null, remind: opts.remind || null, reply: opts.reply || null, ...(opts.tag && { tag: opts.tag }) });
      if (opts.pin) pin(m.id, p.name);
      if (opts.react?.length) autoReact(m, opts.react, opts.reacts ?? 2);
      for (const a of opts.answer || []) answer(m, a.key, a.chance ?? 1, a.vars);
      opts.then?.(m);
    }
    const typing = [...new Set([...queue.filter((q) => q.typeAt <= now && q.at > now).map((q) => q.p.name), ...busy.values()])];
    if (typing.join('|') !== st.typing.join('|')) { st.typing = typing; ctx.emit('typing', typing); }
    if (queue.length) tickT = timer(tick, Math.max(60, Math.min(...queue.map((q) => (q.typeAt > now ? q.typeAt : q.at))) - now));
  }
  /** A run's card (Claude at work on what you sent it): made once, then its steps and state set as it goes. work: { state
   *  'work' | 'wait' | 'done' | 'fail', steps (the latest lines), n (how many), at, end, ask (the approval it waits for) } */
  function workCard(from, work) { const p = who(from); if (!p) return null; return add({ from: p.key, name: p.name, kind: 'work', text: '', work }); }
  function setWork(id, work) { const m = byId(id); if (!m || m.kind !== 'work') return; m.work = { ...m.work, ...work }; update(m); }
  /** A session stuck in a loop (server/loops.mjs): what repeats, then what you did about it. loop: { kind 'repeat' |
   *  'compact' | 'cost', label, n, blocked, usd, mins, state 'on' | 'stopping' | 'stopped' | 'over', hint 'sent' | 'got' |
   *  'lost' | null, sess (its session), task (a run from the office) } */
  function loopCard(from, loop) { const p = who(from); if (!p) return null; return add({ from: p.key, name: p.name, kind: 'loop', text: '', loop }); }
  function setLoop(id, loop) { const m = byId(id); if (!m || m.kind !== 'loop') return; m.loop = { ...m.loop, ...loop }; update(m); }
  /** Someone "typing" for as long as they work on what you asked them (Claude on a message sent to its conversation). */
  function working(from, on) { const p = who(from); if (!p) return; if (on) busy.set(p.key, p.name); else busy.delete(p.key); tick(); }
  /** A reaction ('me' for you); the same emoji again takes it back. */
  function react(id, by, emoji) {
    const m = byId(id); if (!m || !REACTIONS.includes(emoji) || m.recalled) return;
    for (const [e, list] of Object.entries(m.reacts)) { const i = list.indexOf(by); if (i >= 0) { list.splice(i, 1); if (!list.length) delete m.reacts[e]; if (e === emoji) { update(m); return; } } }
    (m.reacts[emoji] ||= []).push(by); update(m);
  }
  function autoReact(m, emojis, n) {
    for (const id of some(n, [m.from])) timer(() => { if (byId(m.id)) react(m.id, id, pickOne(emojis)); }, rand(2500, 16000));
  }
  function answer(m, key, chance = 1, vars) {
    if (Math.random() > chance) return;
    const id = anyone([m.from]);
    if (id) say(id, line('reply', key, vars), { delay: rand(1500, 6000) });
  }
  /** A vote in a poll (an option's index; the same again takes it back). */
  function vote(id, by, i) {
    const m = byId(id); if (m?.kind !== 'poll' || !m.poll.opts[i]) return;
    const had = m.poll.opts[i].by.includes(by);
    for (const o of m.poll.opts) o.by = o.by.filter((x) => x !== by);
    if (!had) m.poll.opts[i].by.push(by);
    update(m);
  }
  function poll(from, q, options, key) {
    const p = who(from); if (!p || !fresh(key)) return;
    options = options.map((t) => short(String(t).trim(), 60)).filter(Boolean).slice(0, 6);
    if (options.length < 2) return;
    system(tr('chat.sys.poll', { name: p.name, q: short(q, 120) }));
    say(from, short(q, 120), { now: true, pin: true, poll: { q: short(q, 120), opts: options.map((t) => ({ t, by: [] })) },
      then: (m) => { for (const id of resting()) timer(() => vote(m.id, id, Math.floor(Math.random() * options.length)), rand(5000, 70000)); } });
  }
  /** A reminder card ("Nhắc hẹn"): title, when (ms), repeat ('week' or ''); people say yes over time; a line when it's due. */
  function remind(from, title, at, repeat = '', key) {
    const p = who(from); if (!p || !fresh(key)) return;
    system(tr('chat.sys.remind', { name: p.name }));
    say(from, title, { now: true, remind: { title, at, repeat, yes: [], no: [] },
      then: (m) => { for (const id of resting()) timer(() => rsvp(m.id, id, true), rand(4000, 60000)); } });
  }
  function rsvp(id, by, yes) {
    const m = byId(id); if (m?.kind !== 'remind') return;
    m.remind.yes = m.remind.yes.filter((x) => x !== by); m.remind.no = m.remind.no.filter((x) => x !== by);
    (yes ? m.remind.yes : m.remind.no).push(by); update(m);
  }
  function pin(id, byName) { const m = byId(id); if (!m) return; st.pinned = id; system(tr('chat.sys.pinned', { name: byName })); ctx.emit('all'); }
  function recall(id) { const m = byId(id); if (!m || m.from !== 'me' || m.recalled) return; Object.assign(m, { recalled: true, text: '', sticker: null, photo: null, reacts: {} }); if (st.pinned === id) st.pinned = null; update(m); }

  /* ---------- what the sessions say about their work (the hooks' events) ---------- */
  const ok = (key, ms) => { const now = ctx.now(); if ((cool.get(key) || 0) > now) return false; cool.set(key, now + ms); return true; };
  const work = (id, key, vars, opts) => say(id, line('work', key, vars), opts);
  const q = (t) => (t ? `“${short(t, 60)}”` : '');
  function onEvent(e) {
    const s = members().find((x) => x.id === e.sess); if (!s) return;
    const id = s.id, project = short(s.project || s.name, 40), task = short(s.task || e.label, 60), v = { project, task, taskq: q(task) };
    if (e.agent) { if (e.type === 'substart' && ok(`${id}:helper`, 30 * 60e3)) work(id, 'helper', v); return; }
    switch (e.type) {
      case 'start': if (ok(`${id}:hello`, 8 * 3600e3)) { system(tr('chat.sys.added', { by: ctx.staffName('__hr') || tr('chat.boss'), name: s.name })); work(id, 'hello', v, { answer: [{ key: 'hello', chance: 0.5, vars: v }] }); } break;
      case 'prompt':
        if (e.label && ok(`${id}:prompt`, 60e3)) {
          started.set(id, { at: ctx.now(), counts: { ...(s.counts || {}) } });
          say('me', `@${s.name} ${e.full || q(e.label)}`, { now: true, long: !!e.full });   // (the whole prompt, as you wrote it)
          work(id, 'ack', { ...v, task: short(e.label, 60), taskq: q(e.label) }, { delay: 900 });
        }
        break;
      case 'stop':
        if (ok(`${id}:done`, 4 * 60e3)) {
          const t0 = started.get(id), d = since(s.counts, t0?.counts), ms = t0 ? ctx.now() - t0.at : 0, reads = d.read + d.web;
          const info = { ...v, took: ms >= 1000 ? took(ms) : '', edits: d.edit || '', cmds: d.cmd || '', reads: reads || '' };
          started.delete(id);
          work(id, d.edit ? 'doneEdit' : d.cmd ? 'doneRun' : reads ? 'doneRead' : 'done', info, { react: ['👍', '❤️'], reacts: 2, answer: [{ key: 'done', chance: 0.4, vars: v }] });
        }
        break;
      case 'wait': case 'ask': if (ok(`${id}:wait`, 3 * 60e3)) work(id, e.type, v, { now: true }); break;
      case 'fail':
        if (e.limit) { if (ok(`${id}:limit`, 30 * 60e3)) work(id, 'limit', v, { react: ['😭'], reacts: 1, answer: [{ key: 'limit', chance: 0.5, vars: v }] }); break; }
        if (ok(`${id}:fail`, 3 * 60e3)) work(id, (cool.get(`${id}:failed`) || 0) > ctx.now() ? 'failAgain' : 'fail', v, { react: ['😭'], reacts: 1, answer: [{ key: 'fail', chance: 0.5, vars: v }] });
        cool.set(`${id}:failed`, ctx.now() + 10 * 60e3);
        break;
      case 'compact': if (ok(`${id}:compact`, 20 * 60e3)) work(id, 'compact', v); break;
      case 'commit': if (ok(`${id}:commit`, 5 * 60e3)) work(id, 'commit', { ...v, msg: short(e.label, 64) }, { react: ['👍'], reacts: 1 }); break;
      case 'push': if (ok(`${id}:push`, 5 * 60e3)) work(id, 'push', { ...v, branch: e.branch || e.label || 'main' }, { react: ['👍'], reacts: 2 }); break;
      case 'deploy': if (ok(`${id}:deploy`, 5 * 60e3)) work(id, 'deploy', v, { react: ['❤️', '👍'], reacts: 3, answer: [{ key: 'deploy', vars: v }] }); break;
      case 'cired': if (ok(`${e.repo}:ci`, 10 * 60e3)) work(id, 'ciRed', v, { react: ['😮'], reacts: 2, answer: [{ key: 'ciRed', chance: 0.7, vars: v }] }); break;
      case 'cigreen': if (ok(`${e.repo}:ci`, 10 * 60e3)) work(id, 'ciGreen', v, { react: ['❤️'], reacts: 2 }); break;
      case 'testok': if (ok(`${id}:test`, 10 * 60e3)) work(id, 'testOk', v, { react: ['👍'], reacts: 1 }); break;
      case 'testfail': if (ok(`${id}:test`, 10 * 60e3)) work(id, 'testFail', v); break;
    }
  }
  const onLeft = (name) => system(tr('chat.sys.left', { name }));
  const onMoved = (id, to) => work(id, 'moved', { to });

  /* ---------- you, writing in it: who it concerns answers ---------- */
  const VERB = { edit: 'edit', write: 'edit', read: 'read', grep: 'read', glob: 'read', cmd: 'cmd', bash: 'cmd', test: 'test', web: 'web', fetch: 'web', search: 'web' };
  function statusOf(m) {
    if (m.status === 'rest') return tr('chat.reply.statusRest');
    const what = m.last?.type ? tr(`chat.verb.${VERB[m.last.type] || 'other'}`, { label: short(m.last.label || '', 40) }) : tr('chat.verb.other', { label: '' });
    return tr('chat.reply.statusWork', { what: what.trim(), task: short(m.task || '', 60) });
  }
  /** You wrote: text (≤600), a sticker (index), a reply to a message (its id). */
  function send({ text = '', sticker = null, replyTo = null } = {}) {
    text = String(text || '').trim().slice(0, 600);
    if (!text && sticker == null) return;
    const r = replyTo && byId(replyTo), reply = r && !r.recalled ? { id: r.id, name: r.name || tr('chat.you'), text: short(r.kind === 'text' ? r.text : r.kind === 'poll' ? r.poll.q : tr(r.kind === 'photo' ? 'chat.photo' : 'chat.sticker'), 90) } : null;
    say('me', text, { now: true, sticker, reply });
    const mine = st.msgs.at(-1);
    if (!text) { const id = anyone(); if (id) say(id, '', { sticker: Math.floor(Math.random() * tr('chat.stickers', null, 'list').length), delay: rand(2000, 6000) }); return; }
    const quote = mine ? { id: mine.id, name: tr('chat.boss'), text: short(text, 90) } : null;
    const low = text.toLowerCase(), named = members().filter((m) => text.includes(`@${m.name}`));
    for (const m of named) say(m.id, statusOf(m), { delay: rand(800, 3000), reply: quote });
    // a reply to one of theirs: that person answers it
    if (r && r.from !== 'me' && !named.some((m) => m.id === r.from) && who(r.from) && !r.from.startsWith('__')) say(r.from, line('reply', 'any', {}), { delay: rand(1200, 3500), reply: quote });
    const reply2 = (key, n = 1) => some(n).forEach((id, i) => say(id, line('reply', key, {}), { delay: rand(1500, 4000) + i * 2500 }));
    if (/họp|meeting|stand-?up/.test(low)) { ctx.act?.('meeting'); say('hr', tr('chat.life.meeting'), { delay: 700 }); reply2('meeting', 2); }
    else if (/về (nhà|đây|trước)|go(ing)? home|bye/.test(low)) reply2('goHome', 2);
    else if (/giỏi|tốt lắm|cảm ơn|cám ơn|good job|well done|thank/.test(low)) reply2('praise', 2);
    else if (!named.length && !r && ok('me:any', 45e3)) reply2('any');   // (a plain line: one answer now and then, not one to every message)
    if (mine && Math.random() < 0.6) autoReact(mine, ['❤️', '👍'], Math.random() < 0.5 ? 1 : 2);
  }
  function photo(dataUrl) { say('me', '', { now: true, photo: dataUrl }); const m = st.msgs.at(-1); if (m?.from === 'me') autoReact(m, ['❤️', '😆', '😮'], 3); }

  /* ---------- by the clock: the morning briefing and the Monday stand-up reminder ---------- */
  const hm = (d) => d.getHours() * 100 + d.getMinutes();
  function at(d, h, m) { const x = new Date(d); x.setHours(h, m, 0, 0); return x.getTime(); }
  function clock() {
    const d = new Date(ctx.now()), day = d.toDateString(), wd = d.getDay(), once = (k) => { if (st.days[k] === day) return false; st.days[k] = day; save(); return true; };
    if (wd % 6 && hm(d) >= 750 && hm(d) < 830) {
      const projects = [...new Set(members().map((m) => m.project || m.name).filter(Boolean))];
      if (projects.length && once('morning')) say('reception', line('life', 'morning', { n: projects.length, projects: short(projects.slice(0, 4).join(', '), 90) }), { react: ['👍'], reacts: 2, answer: [{ key: 'hello', chance: 0.6, vars: { project: projects[0] } }] });
    }
    if (wd === 1 && hm(d) >= 820 && hm(d) < 855 && once('standupRemind')) remind('hr', tr('chat.life.standupTitle'), at(d, 9, 0), 'week');
    // a reminder that has come round: the app's own line for it
    for (const m of st.msgs) if (m.kind === 'remind' && !m.remind.done && m.remind.at <= ctx.now()) { m.remind.done = true; update(m); system(tr('chat.sys.remindNow', { title: m.remind.title })); }
  }

  return { state: st, who, byId, say, system, send, working, workCard, setWork, loopCard, setLoop, react, vote, rsvp, poll, remind, pin, recall, photo, onEvent, onLeft, onMoved, clock, fresh };
}
