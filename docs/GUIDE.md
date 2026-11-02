# Vanphong3d: install and use

Vanphong3d is a fork of [My Office](https://github.com/khanh020905/my-office) (MIT). It draws a **3D office** on your computer where each conversation with Claude is a character sitting at its project's desk. The office grows more rooms and desks as projects are added. The Vietnamese guide, [HUONG-DAN.md](HUONG-DAN.md), has the same content.

What differs from the original:

- It draws **Chat** (claude.ai in the Claude app) and **Cowork** conversations. Claude Code sessions are hidden by default (a setting shows them).
- Each **project** is a **department room** named after it ("Marketing room").
- The outdoor scenery (street, traffic, shops) is gone: the building, a lawn and a path round it.
- Vietnamese is the default language. The group chat talks about **real work** (what is being done, files changed, time taken), with many varied lines instead of small talk.
- The internet tunnel is removed. Only your computer can open the office by default.

> A community project, not made by or affiliated with Anthropic.

## How it works

```
 Chat (claude.ai in the Claude app) ─► office_report tool (MCP, runs on your computer) ─┐
 Cowork (the Claude app's VM)       ─► Cowork plugin ─► a listener on the VM's adapter ─┼─► the office
 Claude Code (terminal, VS Code)    ─► hooks (optional, hidden by default) ─────────────┘  http://localhost:4310
```

Chat runs in the cloud, so nothing on your computer sees it unless it **calls the `office_report` tool**. The office never reads your claude.ai account; it only receives a title, a project name and a short note that Chat sends, never the conversation. Everything it keeps is in the project's `data/` folder. **Never commit `data/`.**

## Requirements

Windows 10/11, macOS or Linux; Node.js 20.9+; Git; the Claude desktop app (for Chat and Cowork); a browser with WebGL.

## Install

```bash
git clone https://github.com/chowpig/vanphong3d.git
cd vanphong3d
npm ci --ignore-scripts
npm run build
node bin/cli.mjs start
```

Open **http://localhost:4310**. The office starts empty; **http://localhost:4310/?demo** shows a demo. `--ignore-scripts` installs the locked dependencies without running their install scripts (the office does not need them). `start` runs in the terminal; closing it stops the office.

To run in the background and at sign-in (and add the hooks for Claude Code, backing up `settings.json` first): `node bin/cli.mjs install --service`. Check everything with `node bin/cli.mjs doctor`. If you only use Chat and Cowork you can skip `install`.

Update: `git pull`, `npm ci --ignore-scripts`, `npm run build`, restart. Remove: `node bin/cli.mjs uninstall`, then delete the folder.

## My projects (department rooms)

Settings → Office → **My projects**: one name per line (for example Marketing, Accounting, Sales, Warehouse), then **Save list**. Each name gets a room. A conversation belongs to a project when the name appears **as whole words** in its title, or when Chat gives `project` in the tool call; accents and case are ignored, the longest name wins, and "informatics" does not match "INFO". A conversation that matches nothing sits in a shared "Chat room". The list is stored in `data/myprojects.json`.

Office size (Settings → Office): **Auto** (default; grows with the number of projects, up to 18), Cozy, Professional, Headquarters. Rooms exist only in Auto and Headquarters.

## Connect Chat

```bash
node bin/cli.mjs chat-setup            # shows what would be added
node bin/cli.mjs chat-setup --write    # adds it to the Claude app's config (a backup first)
```

It finds the app's `claude_desktop_config.json` (the Microsoft Store build keeps it under `%LOCALAPPDATA%\Claude-Data\...`). To edit by hand, add under `mcpServers`: `"my-office": { "command": "node", "args": ["/full/path/to/vanphong3d/mcp/office-mcp.mjs"] }`. Then **quit the Claude app completely (also from the tray) and reopen it**.

Chat only appears when it calls the tool, and it does not on its own. Paste this into **Settings → Preferences** on claude.ai so every chat does:

> In EVERY conversation, before answering the first message, call the office_report tool with status "working", conversation set to the first few words of the first message (use exactly the same text on every later call), a short neutral title, and project if the conversation is in a Claude project. When you finish answering each message, call office_report with status "done". Never put private content in title or note. If the tool fails or is missing, carry on without mentioning it.

Test: in a new chat, ask *"Call office_report with conversation 'test', status working"*. A "Chat · test" character appears. Limits: only conversations from the moment they call the tool appear (not old ones from Recents); a conversation is remembered for 6 hours, also across restarts, or until it reports `closed`.

## Connect Cowork (optional, partly verified)

Cowork runs in a virtual machine that cannot see your `localhost`. On Windows the office therefore also listens on the Hyper-V virtual adapter (`vEthernet`) used by the VM, **only** for `POST /event` with the office key and `GET /health`, only from that adapter's own subnet; nothing else, and not the home network or the internet. `OFFICE_VM_BIND=off` turns it off.

```bash
node bin/cli.mjs cowork-plugin
```

creates `cowork-plugin.plugin`. In the Claude app: Customize → Plugins → upload a plugin → choose it → turn it on. **The file contains your office key: do not share or commit it.** A new Cowork task starts with a line "Nhà Gỗ Office: connected via …" or "office not found (tried …)". The server side is tested with simulated events; a real Cowork session in the VM has not been verified on every setup. If it cannot connect, check that the office is running and that the firewall allows Node.js on private networks.

## Using the office

Drag to rotate; the wheel zooms about 8% a notch; **W A S D** or the arrow keys move the view across the floor (Shift is faster; they do nothing while you type or while a session is open, and in first person they walk). The group chat reports real work with varied lines. To also draw Claude Code sessions: Settings → Office → **Also show Claude Code sessions** and run `node bin/cli.mjs install`.

Phones (optional): the phone button turns on "Open on phones"; phones need the 8-digit PIN; use only on a network you trust (plain HTTP).

## The four standing assistants (Accounting, HR, Construction, Assistant)

A row of four desks along the meeting room's glass, inside the company floor, holds four people. They are not Claude sessions: they are your standing assistants. (The small Cozy office has no room for them; the chat window still works there.) Two more people walk about on their own all day: the **janitor** mops the aisles in rounds, every 40 minutes from 7:00 to 21:00, and the **security guard** patrols, stops to check, jots in his book and says a few words.

- **Each one owns an area.** The office keeps a **ledger** (on your computer, in `data/assistants/`) of every Chat and Cowork conversation it sees: title, project, a short note, running or ended. A conversation belongs to an area when its title, project or note holds the area's words (accounting, invoice, tax… / HR, hiring, payroll… / construction, site, drawings…). Whatever is none of the first three goes to **Assistant** (personal matters and everything else). The words can be changed in each one's ⚙. The ledger holds only what Chat and Cowork told the office; it cannot read your claude.ai profile or history.
- **Click one** (or the **Assistants** button, top left) to open a chat of their own. They answer with Claude Code from their ledger and your chat history only; with nothing in the ledger they say so.
- **In the group chat**, name one ("@Accounting how is this month?") and they type and answer right there, in a lively tone.
- **Jobs**: press **Give a job** in their chat, or write an order that names them in the group. They run Claude Code **in their own working folder** (⚙ → Working folder, settable only on the computer that runs the office) and ask you to approve edits and commands like any session. With no folder set they take no job.
- You need Claude Code signed in (`claude auth login`). Each question is a call to Claude (60 an hour at most), counted on the account new sessions use.
## Troubleshooting

| Problem | Fix |
|---|---|
| Page loads but is empty | Normal until a chat reports. Try `/?demo`. See Connect Chat. |
| A chat does not appear | Run `chat-setup`, reopen the app; paste the Preferences text; check the app's `mcp-server-my-office.log` for `tools/call` lines (Windows store build: `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Local\Claude\logs`; classic Windows: `%APPDATA%\Claude\logs`; macOS: `~/Library/Logs/Claude`). |
| Chat not in the right room | Add the project to My projects; put the name in the chat title; use Auto or Headquarters size; reload once. |
| "Claude plan unreadable" | `claude auth login` in a terminal. Only the plan card is affected. |
| "Claude Code not found" | Set `OFFICE_CLAUDE_BIN` to the full path of `claude`. npm installs on Windows are found automatically. |
| Cowork: "office not found" | Office not running; firewall blocks the VM; not Windows/Hyper-V. The adapter address changes after a reboot and the office follows within 30 s. |
| Port 4310 is taken | `OFFICE_PORT=4320`. |
| Slow | Lower graphics (Settings → Display). Without a GPU the office is drawn in software. |

Environment: `OFFICE_PORT`, `OFFICE_HOST`, `OFFICE_LANG` (`vi`/`en`), `OFFICE_DATA_DIR`, `OFFICE_USAGE=0`, `OFFICE_CI=0`, `OFFICE_TRANSLATE`, `OFFICE_SHOW_CODE=1`, `OFFICE_VM_BIND=off`.

## Tests and known limits

`npm test`, `npm run typecheck && npm run lint`, `npm run build && npm run smoke`, `npm run test:e2e` (about 1.5 hours on Windows, where the 3D page is drawn in software; tests that need the bash stand-in for Claude Code skip themselves there). Dead outdoor-scene code remains but is inert. The product name in the UI is "Nhà Gỗ Office". See [SECURITY.md](../SECURITY.md) for the security model.

## Licence and credits

MIT; the original copyright (khanh020905) and this fork's (chowpig) are in [LICENSE](../LICENSE). Original: <https://github.com/khanh020905/my-office>.
