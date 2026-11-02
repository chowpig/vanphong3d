#!/usr/bin/env node
// A tool for Claude Chat (in the Claude desktop app) to tell the office about a conversation. Chat runs in the cloud, so
// nothing on this computer sees it; this local MCP server (add it to the app's claude_desktop_config.json, see
// docs/VANPHONG3D.md) gives Chat one tool, office_report, and the office draws the conversation as a "Chat · …"
// character. It talks MCP over stdin/stdout (JSON-RPC, one message a line) and posts to the office on this computer
// only, with the key in data/token. The conversation's words are never sent, only the title, the project and a note.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** what the app may add to Claude's instructions for every conversation (the MCP `instructions` field) */
export const INSTRUCTIONS = 'My Office draws each conversation as a character, but only when you tell it. In EVERY conversation, before you answer the first message, call office_report with status "working", a "conversation" made of the first few words of the first message (use exactly the same text on every later call), a short neutral "title", and "project" if the conversation is in a Claude project. When you have finished answering each message, call office_report with status "done". Never put private content in title or note. If the tool is unavailable or fails, carry on without mentioning it.';
export const TOOL = {
  name: 'office_report',
  description: 'ALWAYS call this at the start of every conversation and again when you finish answering. Tells the My Office app (on this computer) what this conversation is doing, so it shows as a character in the office. Call it with status "working" when you start on the user\'s request, "done" when you have answered, and "closed" only if the user says the conversation is over. Pass the same "conversation" every time for the same conversation. Never put private content in title or note: a few neutral words.',
  inputSchema: {
    type: 'object',
    properties: {
      conversation: { type: 'string', description: 'A short stable name for this conversation, the same on every call (for example its title).' },
      status: { type: 'string', enum: ['working', 'done', 'closed'] },
      title: { type: 'string', description: 'The conversation\'s title, a few words.' },
      project: { type: 'string', description: 'The Claude project this conversation belongs to, if any (for example INFO).' },
      note: { type: 'string', description: 'What it is doing, in a few neutral words.' },
    },
    required: ['conversation', 'status'],
  },
};

export const sidOf = (conversation) => `chat-${crypto.createHash('sha1').update(String(conversation || '').trim().toLowerCase()).digest('hex').slice(0, 12)}`;
const clip = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** the hook events a report becomes: a conversation seen for the first time starts first */
export function eventsFor(args, seen) {
  const conversation = clip(args?.conversation, 120), status = args?.status;
  if (!conversation || !['working', 'done', 'closed'].includes(status)) return null;
  const sid = sidOf(conversation), title = clip(args.title || conversation, 80), project = clip(args.project, 60), note = clip(args.note, 120);
  const base = { session_id: sid, cwd: path.join(os.homedir(), 'Chat', project || 'Chat'), office_title: title, office_project: project };
  const out = [];
  if (!seen.has(sid)) { seen.add(sid); out.push({ ...base, hook_event_name: 'SessionStart', source: 'startup' }); }
  if (status === 'working') out.push({ ...base, hook_event_name: 'UserPromptSubmit', prompt: note || title });
  else if (status === 'done') out.push({ ...base, hook_event_name: 'Stop', last_assistant_message: note });
  else { out.push({ ...base, hook_event_name: 'SessionEnd', reason: 'other' }); seen.delete(sid); }
  return out;
}

/** the JSON-RPC handler: returns the reply for a request, or null for a notification. `post(event)` sends one event to the office */
export function createHandler({ post }) {
  const seen = new Set();
  return async (msg) => {
    if (!msg || typeof msg !== 'object') return null;
    const { id, method, params } = msg, reply = (result) => ({ jsonrpc: '2.0', id, result }), fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
    if (id === undefined || id === null) return null;   // (a notification, such as notifications/initialized: no answer)
    if (method === 'initialize') return reply({ protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'my-office', version: '0.1.0' }, instructions: INSTRUCTIONS });
    if (method === 'ping') return reply({});
    if (method === 'tools/list') return reply({ tools: [TOOL] });
    if (method === 'tools/call') {
      if (params?.name !== TOOL.name) return fail(-32602, `unknown tool: ${params?.name}`);
      const events = eventsFor(params.arguments, seen);
      if (!events) return reply({ isError: true, content: [{ type: 'text', text: 'conversation and status (working, done or closed) are needed' }] });
      let sent = 0; for (const e of events) if (await post(e)) sent++;
      return reply({ content: [{ type: 'text', text: sent === events.length ? 'ok' : 'The office is not running on this computer (nothing was sent).' }] });
    }
    return fail(-32601, `method not found: ${method}`);
  };
}

const post = async (event) => {
  let key = ''; try { key = fs.readFileSync(path.join(process.env.OFFICE_DATA_DIR || path.join(ROOT, 'data'), 'token'), 'utf8').trim(); } catch { /* the office never ran here */ }
  try {
    const r = await fetch(`${process.env.OFFICE_URL || 'http://127.0.0.1:4310'}/event`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Office-Key': key, 'X-Office-Source': 'chat' }, body: JSON.stringify(event), signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const handle = createHandler({ post });
  const rl = readline.createInterface({ input: process.stdin });
  let chain = Promise.resolve();   // (answers in the order the requests came)
  rl.on('line', (line) => {
    chain = chain.then(async () => {
      let msg; try { msg = JSON.parse(line); } catch { return; }
      const out = await handle(msg).catch((e) => ({ jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32603, message: String(e?.message || e) } }));
      if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
    });
  });
  // (stdin closed: the app is done with us. No process.exit here: on Windows it can trip a libuv assertion with a request in flight)
  rl.on('close', () => { chain.then(() => { process.exitCode = 0; }); });
}
