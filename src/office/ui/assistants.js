// The assistants' panel: a button (bottom left) and a window with a tab for each of Kế Toán, Nhân Sự, Xây Dựng, Trợ Lý.
// Each tab is a chat of its own with that assistant (what it knows: its ledger, kept by the server), a "Giao việc" button
// that gives it a job in its working folder, and its settings (the words of its area, its folder). Clicking the
// assistant in the office opens the same window on its tab. The server: server/assistants.mjs, /api/assistants.
import { $, el } from '../core/env.js';
import { DEMO } from '../demo/demo.js';
import { TOKEN } from '../net/live.js';
import { state } from '../core/state.js';
import { ASST, setBusy, viewCabin } from '../people/assistants.js';
import { t as tr } from '../../i18n/index.js';

let list = [], active = 'ketoan', open = false, showSettings = false, step = '';
const nodes = {};
const url = () => `/api/assistants${TOKEN ? `?k=${encodeURIComponent(TOKEN)}` : ''}`;
const post = (body, path = '/api/assistants') => fetch(`${path}${TOKEN ? `?k=${encodeURIComponent(TOKEN)}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json().catch(() => ({ ok: false }))).catch(() => ({ ok: false }));
const item = (k) => list.find((x) => x.key === k);
const colorOf = (k) => ASST.find((a) => a.key === k)?.color || '#888';

/** The server's word on the page ({ k: 'asst', op: 'state' | 'msg' | 'step', key, … }): demo.js. */
export function asstApply(d) {
  const it = item(d.key);
  if (d.op === 'state') { if (it) it.busy = d.state === 'work'; setBusy(d.key, d.state === 'work'); if (!it?.busy && d.key === active) step = ''; render(); }
  else if (d.op === 'msg' && it) { if (!it.history.some((m) => m.id === d.m.id)) it.history.push(d.m); if (it.history.length > 120) it.history.shift(); step = ''; render(true); }
  else if (d.op === 'step' && d.key === active) { step = String(d.step || ''); renderStatus(); }
}
export async function loadAssistants() {
  const r = await fetch(url()).then((x) => x.json()).catch(() => null);
  if (!r?.ok) return;
  list = r.list; for (const it of list) setBusy(it.key, !!it.busy);
  render();
}
export function openAssistant(key) {
  if (key && item(key)) active = key;
  open = true; nodes.panel.hidden = false; nodes.btn.classList.add('on');
  loadAssistants();
}
export function closeAssistants() { open = false; nodes.panel.hidden = true; nodes.btn.classList.remove('on'); }

function bubble(m, it) {
  const b = el('div', `asst-msg asst-msg--${m.r}`);
  if (m.r !== 'sys') { const who = el('b', 'asst-who', m.r === 'me' ? tr('asst.you') : it.name); b.append(who); }
  if (m.job) b.append(el('span', 'asst-tag', tr('asst.jobTag')));
  b.append(el('div', 'asst-text', m.t));
  return b;
}
function renderStatus() {
  const it = item(active); if (!nodes.status) return;
  nodes.status.hidden = !it?.busy;
  nodes.status.textContent = it?.busy ? `${it.name} ${step ? `· ${step}` : tr('asst.working')}` : '';
}
function render(scroll = false) {
  if (!nodes.panel) return;
  const it = item(active); if (!it) return;
  // tabs
  nodes.tabs.replaceChildren(...list.map((x) => {
    const b = el('button', `asst-tab${x.key === active ? ' on' : ''}${x.busy ? ' busy' : ''}`); b.type = 'button'; b.style.setProperty('--c', colorOf(x.key));
    b.append(el('span', 'asst-dot'), el('span', 'asst-tabname', x.name));
    if (x.counts.running) b.append(el('span', 'asst-badge', String(x.counts.running)));
    b.onclick = () => { active = x.key; step = ''; render(true); };
    return b;
  }));
  nodes.role.textContent = tr(`asst.role.${it.key}`);
  nodes.counts.textContent = tr('asst.counts', it.counts);
  nodes.msgs.replaceChildren(...(it.history.length ? it.history.map((m) => bubble(m, it)) : [el('div', 'asst-empty', tr('asst.empty'))]));
  if (scroll || true) nodes.msgs.scrollTop = nodes.msgs.scrollHeight;
  nodes.input.placeholder = tr('asst.placeholder', { name: it.name });
  nodes.job.disabled = !state.isLocal;
  nodes.job.title = state.isLocal ? tr('asst.jobTitle', { name: it.name }) : tr('asst.macOnly');
  // settings
  nodes.set.hidden = !showSettings;
  nodes.setBtn.classList.toggle('on', showSettings);
  if (showSettings && nodes.wordsFor !== it.key) {
    nodes.wordsFor = it.key;
    nodes.words.value = (it.words || []).join('\n'); nodes.words.disabled = !!it.fixedWords;
    nodes.wordsNote.textContent = it.fixedWords ? tr('asst.wordsFixed') : tr('asst.wordsHint');
    nodes.dir.value = it.dir || ''; nodes.dirOpen.disabled = nodes.dirClear.disabled = !state.isLocal; nodes.words.disabled = !!it.fixedWords || !state.isLocal;
    nodes.save.disabled = !state.isLocal; nodes.saved.textContent = state.isLocal ? '' : tr('asst.macOnly');
  }
  renderStatus();
}

async function ask(job) {
  const it = item(active), text = nodes.input.value.trim(); if (!it || !text) return;
  nodes.input.value = '';
  const r = await post({ op: 'chat', key: it.key, text, job });
  if (!r.ok && r.message) { it.history.push({ id: `e${Date.now()}`, r: 'sys', t: r.message, at: Date.now() }); render(true); }
}

export function setup() {
  const wrap = $('stage-wrap'); if (!wrap) return;
  const btn = el('button', 'asst-btn'); btn.type = 'button'; btn.id = 'asst-btn'; btn.append(el('span', 'asst-btn-ico', '👥'), el('span', null, tr('asst.button')));
  btn.title = tr('asst.title'); btn.onclick = () => (open ? closeAssistants() : openAssistant());
  const panel = el('div', 'asst-panel'); panel.id = 'asst-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', tr('asst.title'));
  const head = el('div', 'asst-head'), close = el('button', 'asst-x', '✕'); close.type = 'button'; close.title = tr('asst.close'); close.onclick = closeAssistants;
  head.append(el('b', null, tr('asst.title')), close);
  const tabs = el('div', 'asst-tabs');
  const sub = el('div', 'asst-sub'), role = el('span', 'asst-role'), counts = el('span', 'asst-counts');
  const see = el('button', 'asst-link', '📍'); see.type = 'button'; see.title = tr('asst.cabin'); see.onclick = () => viewCabin(active);
  const setBtn = el('button', 'asst-link', '⚙'); setBtn.type = 'button'; setBtn.title = tr('asst.settings'); setBtn.onclick = () => { showSettings = !showSettings; nodes.wordsFor = ''; render(); };
  sub.append(el('div', 'asst-subtext'), see, setBtn); sub.firstChild.append(role, counts);
  const note = el('div', 'asst-note', ''); note.textContent = tr('asst.ledgerNote');
  const set = el('div', 'asst-set'); set.hidden = true;
  const words = el('textarea', 'asst-words'); words.rows = 4; const wordsNote = el('div', 'asst-hint');
  const dir = el('input', 'asst-dir'); dir.type = 'text'; dir.placeholder = tr('asst.dirPlaceholder'); dir.readOnly = true;   // (chosen, never typed)
  const dirRow = el('div', 'asst-dirrow'), dirOpen = el('button', 'asst-save', tr('asst.dirOpen')), dirClear = el('button', 'asst-job', tr('asst.dirClear')); dirOpen.type = dirClear.type = 'button';
  dirRow.append(dir, dirOpen, dirClear);
  const save = el('button', 'asst-save', tr('asst.save')); save.type = 'button'; const saved = el('span', 'asst-saved');
  save.onclick = async () => {
    const it = item(active); if (!it) return;
    const body = { op: 'config', key: it.key, ...(it.fixedWords ? {} : { words: words.value.split('\n').map((x) => x.trim()).filter(Boolean) }) };
    const r = await post(body);
    saved.textContent = r.ok ? tr('asst.saved') : r.message || tr('asst.badDir');
    if (r.ok) { list = r.list; nodes.wordsFor = ''; render(); saved.textContent = tr('asst.saved'); }
  };
  const setDir = async (path) => {
    const it = item(active); if (!it) return;
    const r = await post({ op: 'config', key: it.key, dir: path });
    if (r.ok) { list = r.list; nodes.wordsFor = ''; render(); saved.textContent = tr('asst.saved'); } else saved.textContent = r.message || tr('asst.badDir');
  };
  dirOpen.onclick = async () => {
    saved.textContent = '';
    const r = await post({ op: 'pick' }, '/api/pick-folder');
    if (r.ok) setDir(r.path); else saved.textContent = r.message || tr('asst.pick.failed');
  };
  dirClear.onclick = () => setDir('');
  set.append(el('label', 'asst-lbl', tr('asst.words')), words, wordsNote, el('label', 'asst-lbl', tr('asst.dir')), dirRow, el('div', 'asst-hint', tr('asst.dirHint')), el('div', 'asst-row', ''), save, saved);
  const msgs = el('div', 'asst-msgs'), status = el('div', 'asst-status'); status.hidden = true;
  const form = el('div', 'asst-form'), input = el('textarea', 'asst-input'); input.rows = 2;
  const send = el('button', 'asst-send', tr('asst.send')); send.type = 'button'; send.onclick = () => ask(false);
  const job = el('button', 'asst-job', tr('asst.job')); job.type = 'button'; job.onclick = () => ask(true);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(false); } e.stopPropagation(); });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  form.append(input, el('div', 'asst-btns'));
  form.lastChild.append(send, job);
  panel.append(head, tabs, sub, note, set, msgs, status, form);
  wrap.append(btn, panel);
  Object.assign(nodes, { btn, panel, tabs, role, counts, msgs, status, input, job, set, setBtn, words, wordsNote, dir, dirOpen, dirClear, save, saved, wordsFor: '' });
  list = ASST.map((a) => ({ key: a.key, id: a.id, name: tr(`asst.name.${a.key}`), words: [], fixedWords: a.key === 'troly', dir: '', counts: { running: 0, open: 0, total: 0 }, busy: false, history: [] }));
  render();
  if (DEMO || new URLSearchParams(location.search).has('demo')) { btn.hidden = true; return; }
  loadAssistants();
  if (new URLSearchParams(location.search).has('debug')) setTimeout(function hook() { if (!window.__office) { setTimeout(hook, 200); return; } Object.assign(window.__office, { openAssistant, asstList: () => list }); }, 0);
}
