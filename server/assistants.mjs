// The four standing assistants (Kế Toán, Nhân Sự, Xây Dựng, Trợ Lý): each knows the conversations (Chat, Cowork) that
// concern it, running or not, from a ledger the office keeps on this computer, and answers you with Claude Code (`claude
// -p`, no tools at all: it only reads the ledger it is given). Giving one a job is a different path (server/tasks.mjs:
// a run in the assistant's own folder, asking for approval like any session). The ledger holds what the conversations
// told the office (a title, a project, a short note): never the conversations themselves.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { norm } from './myprojects.mjs';

/** key, id (the sender in the group chat), the words that put a conversation in this one's area ('' = everything else). */
export const ASSISTANTS = [
  { key: 'ketoan', id: '__ketoan', role: 'kế toán (sổ sách, hoá đơn, thuế, công nợ, báo cáo tài chính)', words: ['kế toán', 'hoá đơn', 'hóa đơn', 'thuế', 'sổ sách', 'công nợ', 'báo cáo tài chính', 'kiểm toán', 'accounting', 'invoice', 'tax'] },
  { key: 'nhansu', id: '__nhansu', role: 'nhân sự (tuyển dụng, lương, chấm công, hợp đồng lao động, nhân viên)', words: ['nhân sự', 'tuyển dụng', 'lương', 'chấm công', 'hợp đồng lao động', 'nhân viên', 'hr', 'payroll', 'recruit'] },
  { key: 'xaydung', id: '__xaydung', role: 'xây dựng (công trình, thi công, bản vẽ, dự toán, vật liệu)', words: ['xây dựng', 'công trình', 'thi công', 'bản vẽ', 'dự toán', 'vật liệu', 'nhà gỗ', 'construction'] },
  { key: 'troly', id: '__troly', role: 'trợ lý riêng (việc cá nhân và mọi việc không thuộc kế toán, nhân sự, xây dựng)', words: [] },
];
export const byKey = (k) => ASSISTANTS.find((a) => a.key === k) || null;
export const byId = (id) => ASSISTANTS.find((a) => a.id === id) || null;

const MAX_ENTRIES = 600, KEEP_MS = 400 * 86400e3, MAX_HISTORY = 120;
const clipS = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const hasWord = (hay, word) => { const w = norm(word); return !!w && ` ${hay} `.includes(` ${w} `); };

/** The assistant whose area a conversation falls in: its words found whole in the title, the project or the note; else the last one. */
export function classify(entry, words) {
  const hay = norm(`${entry.title || ''} ${entry.project || ''} ${entry.note || ''}`);
  for (const a of ASSISTANTS) if ((words[a.key] || []).some((w) => hasWord(hay, w))) return a.key;
  return 'troly';
}

/** Who a line in the group chat is for: the assistants named in it ("@Kế Toán", "kế toán ơi", "Trợ lý ..."), at most `max`. */
export function mentioned(text, names, max = 2) {
  const low = ` ${norm(text)} `, out = [];
  for (const [key, name] of Object.entries(names)) if (low.includes(` ${norm(name)} `)) out.push(key);
  return out.slice(0, max);
}
/** A line that gives a job, rather than asking or chatting. */
export const isJob = (text) => /(^| )(giao viec|giao cho|lam giup|lam ho|soan|lap|tao file|tao bao cao|sua|xu ly|tong hop ra|xuat file|xuat bao cao)( |$)/.test(norm(text));

export function createAssistants({ dataDir, claude, env, perHour = 60, timeout = 90_000, max = 2 }) {
  const dir = path.join(dataDir, 'assistants'), ledgerFile = path.join(dir, 'ledger.json'), cfgFile = path.join(dir, 'config.json');
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  const write = (f, v) => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(`${f}.tmp`, JSON.stringify(v)); fs.renameSync(`${f}.tmp`, f); } catch { /* read-only data folder: kept in memory */ } };
  let ledger = read(ledgerFile, { v: 1, entries: {} }), cfg = read(cfgFile, { v: 1, words: {}, dirs: {} }), saveT = null;
  if (!ledger.entries) ledger = { v: 1, entries: {} };
  const histFile = (k) => path.join(dir, `chat-${k}.json`), hist = new Map(), running = new Set(), recent = [];

  /* ---------- config: the words of each area, the folder each one works in ---------- */
  const words = () => Object.fromEntries(ASSISTANTS.map((a) => [a.key, Array.isArray(cfg.words?.[a.key]) ? cfg.words[a.key] : a.words]));
  const dirOf = (k) => { const d = cfg.dirs?.[k]; return d && fs.existsSync(d) && fs.statSync(d).isDirectory() ? d : ''; };
  function setConfig(k, { words: w, dir: d } = {}) {
    if (!byKey(k)) return false;
    if (Array.isArray(w) && k !== 'troly') cfg.words[k] = [...new Set(w.map((x) => clipS(x, 40)).filter(Boolean))].slice(0, 40);
    if (typeof d === 'string') {
      const p = d.trim(); if (!p) delete cfg.dirs[k];
      else { const r = path.resolve(p); if (!path.isAbsolute(p) || !fs.existsSync(r) || !fs.statSync(r).isDirectory()) return false; cfg.dirs[k] = r; }
    }
    write(cfgFile, cfg); return true;
  }

  /* ---------- the ledger: every conversation the office has drawn, kept after it has gone ---------- */
  function touch(list, now = Date.now()) {
    let changed = false;
    for (const s of list) {
      const k = String(s.id || ''); if (!k) continue;
      const e = ledger.entries[k] || { id: k, first: now }, next = { ...e, title: clipS(s.title, 80), project: clipS(s.project, 60), src: s.src || e.src || '', note: clipS(s.note || e.note || '', 160), status: s.status || 'rest', last: s.status === 'work' ? now : e.last || now, live: true, n: s.n ?? e.n ?? 0 };
      if (JSON.stringify(next) !== JSON.stringify(e)) { ledger.entries[k] = next; changed = true; }
    }
    // (a conversation the office no longer draws is not running)
    const liveIds = new Set(list.map((s) => String(s.id)));
    for (const e of Object.values(ledger.entries)) if (e.live && !liveIds.has(e.id)) { e.live = false; e.status = 'ended'; changed = true; }
    const all = Object.values(ledger.entries).filter((e) => now - (e.last || e.first) < KEEP_MS).sort((a, b) => (b.last || 0) - (a.last || 0)).slice(0, MAX_ENTRIES);
    if (all.length !== Object.keys(ledger.entries).length) { ledger.entries = Object.fromEntries(all.map((e) => [e.id, e])); changed = true; }
    if (changed) { clearTimeout(saveT); saveT = setTimeout(() => write(ledgerFile, ledger), 1500); saveT.unref?.(); }
  }
  const entriesOf = (k) => { const w = words(); return Object.values(ledger.entries).filter((e) => classify(e, w) === k).sort((a, b) => (b.last || 0) - (a.last || 0)); };
  const ago = (ms) => { const m = Math.max(0, Math.round(ms / 60e3)); return m < 2 ? 'vừa xong' : m < 60 ? `${m} phút trước` : m < 48 * 60 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`; };
  const counts = (k) => { const l = entriesOf(k); return { running: l.filter((e) => e.live && e.status === 'work').length, open: l.filter((e) => e.live).length, total: l.length }; };
  /** The ledger of one assistant, as text for Claude: the running ones first, then the rest, newest first. */
  function digest(k, now = Date.now()) {
    const list = entriesOf(k).slice(0, 40);
    if (!list.length) return '(Sổ trống: chưa có cuộc trò chuyện nào thuộc mảng này được văn phòng ghi nhận.)';
    return list.sort((a, b) => Number(b.live && b.status === 'work') - Number(a.live && a.status === 'work')).map((e) => {
      const st = e.live ? (e.status === 'work' ? 'ĐANG CHẠY' : 'đang mở, nghỉ') : 'đã kết thúc';
      return `- [${st}] "${e.title || '(không tên)'}"${e.project ? ` · dự án ${e.project}` : ''} · ${e.src === 'cowork' ? 'Cowork' : e.src === 'chat' ? 'Chat' : 'phiên'} · hoạt động ${ago(now - (e.last || now))}${e.note ? ` · ghi chú: ${e.note}` : ''}`;
    }).join('\n');
  }

  /* ---------- what you said to each one, kept (the last turns go into the next question) ---------- */
  function history(k) { if (!hist.has(k)) hist.set(k, read(histFile(k), [])); return hist.get(k); }
  function remember(k, who, text, extra = {}) {
    const h = history(k), m = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, r: who, t: String(text).slice(0, 4000), at: Date.now(), ...extra };
    h.push(m); if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
    write(histFile(k), h); return m;
  }

  /* ---------- the answer: Claude Code with no tools, the ledger and the last turns in the question ---------- */
  const persona = (a, name, mode) => [
    `Bạn là ${name}, ${a.role} của chủ văn phòng (bạn gọi họ là "sếp"). Bạn là một nhân vật trong văn phòng 3D "Nhà Gỗ Office".`,
    'Bạn chỉ biết những gì có trong SỔ dưới đây (các cuộc trò chuyện Chat/Cowork mà văn phòng đã ghi nhận, kể cả đã kết thúc) và lịch sử trò chuyện. Không bịa thêm sự việc, số liệu, tên người. Nếu sổ không có thì nói thẳng là chưa có ghi nhận và hỏi sếp thêm.',
    'Bạn không có công cụ nào lúc này: không mở được file, không chạy được lệnh. Nếu sếp cần bạn làm việc cụ thể (soạn file, sửa file), nhắc sếp dùng nút "Giao việc".',
    mode === 'group'
      ? 'Đang trong nhóm chat chung: trả lời 1 đến 2 câu ngắn, vui vẻ, dễ thương, có thể kèm 1 emoji, vẫn đúng việc. Không dùng gạch đầu dòng.'
      : 'Đang trò chuyện riêng với sếp: trả lời rõ ràng, thân thiện, có tổng hợp từ sổ khi liên quan; ngắn gọn dưới 180 từ trừ khi sếp cần chi tiết.',
    'Viết tiếng Việt có dấu, xưng "em", gọi "sếp".',
  ].join('\n');
  const turns = (k, n = 10) => history(k).filter((m) => m.r === 'me' || m.r === 'ai').slice(-n).map((m) => `${m.r === 'me' ? 'Sếp' : 'Em'}: ${clipS(m.t, 500)}`).join('\n');
  const wrap = (k, text, now) => `<so>\n${digest(k, now)}\n</so>\n<lich_su>\n${turns(k) || '(chưa có)'}\n</lich_su>\nSếp nói: ${text}`;

  /** { key, name, text, mode: 'dm' | 'group' } -> { ok, text } | { ok: false, code, detail? }. At most `max` at once, `perHour` an hour. */
  async function ask({ key, name, text, mode = 'dm' }) {
    const a = byKey(key); text = String(text || '').trim().slice(0, 1500);
    if (!a || !text) return { ok: false, code: 'empty' };
    if (running.has(key)) return { ok: false, code: 'busy' };
    if (running.size >= max) return { ok: false, code: 'busy' };
    const now = Date.now(); while (recent.length && now - recent[0] > 3600e3) recent.shift();
    if (recent.length >= perHour) return { ok: false, code: 'tooMany' };
    const bin = claude(); if (!bin) return { ok: false, code: 'noClaude' };
    const cwd = path.join(dir, 'run'); try { fs.mkdirSync(cwd, { recursive: true }); } catch { /* runs where it can */ }
    const args = ['-p', wrap(key, text, now), '--model', mode === 'group' ? 'haiku' : 'sonnet', '--tools', '', '--strict-mcp-config', '--max-turns', '1', '--output-format', 'json',
      '--no-session-persistence', '--settings', '{"disableAllHooks":true}', '--system-prompt', persona(a, name, mode)];
    const e = { ...env(), CLAUDE_CODE_SAFE_MODE: '1', CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' };
    for (const x of Object.keys(e)) if (e[x] == null) delete e[x];
    running.add(key); recent.push(now);
    try {
      return await new Promise((resolve) => {
        let out = '', err = '', done = false, proc, timer = 0;
        const finish = (r) => { if (done) return; done = true; clearTimeout(timer); resolve(r); };
        try { proc = spawn(bin.file, args, { cwd: fs.existsSync(cwd) ? cwd : undefined, env: e, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: true }); }
        catch { finish({ ok: false, code: 'noClaude' }); return; }
        timer = setTimeout(() => { try { if (process.platform === 'win32') proc.kill(); else process.kill(-proc.pid, 'SIGTERM'); } catch { try { proc.kill(); } catch { /* gone */ } } finish({ ok: false, code: 'timeout' }); }, timeout);
        proc.stdout.on('data', (c) => { if (out.length < 1e6) out += c; });
        proc.stderr.on('data', (c) => { err = String(c).trim().split('\n').pop().slice(0, 200); });
        proc.on('error', () => finish({ ok: false, code: 'noClaude' }));
        proc.on('exit', (code) => {
          let j = null; for (const line of [out.trim(), ...out.trim().split('\n').reverse()]) { try { j = JSON.parse(line); break; } catch { /* not it */ } }
          const said = String(j?.result || '').trim().slice(0, mode === 'group' ? 600 : 3800);
          if (j && !j.is_error && said) finish({ ok: true, text: said });
          else finish({ ok: false, code: 'failed', detail: String((j?.is_error && j.result) || err || (code ? `exit ${code}` : '')).slice(0, 200) });
        });
      });
    } finally { running.delete(key); }
  }
  /** The system words a job run gets: who it is, its area's ledger (the run itself has its tools and its approvals). */
  const jobSystem = (k, name) => { const a = byKey(k); return `Bạn là ${name}, ${a.role} của chủ văn phòng. Làm đúng việc sếp giao, trong thư mục này. Sổ các cuộc trò chuyện thuộc mảng của bạn:\n${digest(k)}\nKhông bịa; báo lại ngắn gọn bằng tiếng Việt những gì đã làm, file nào đã tạo hoặc sửa.`; };

  return { ASSISTANTS, words, dirOf, setConfig, touch, counts, digest, entriesOf, history, remember, ask, jobSystem, busy: (k) => running.has(k), classify: (e) => classify(e, words()) };
}
