# Security

Vanphong3d is a local tool: it runs on your own computer and is meant to be opened by you only.

## What it opens and to whom

| Listener | Who can reach it | What it serves |
|---|---|---|
| `127.0.0.1:4310` (default) | this computer only | the office, the API, the hooks |
| the network addresses of this computer | only after **you** turn on "Open on phones"; a PIN is needed | the office for phones (watch; approving is a separate opt-in) |
| the Hyper-V virtual adapter (`vEthernet`, Windows) | only machines on that adapter's own subnet (Cowork's VM); off with `OFFICE_VM_BIND=off` | `GET /health` and `POST /event` with the office key, nothing else |

There is no tunnel and no path from the internet. The page is plain HTTP, so only open it to phones on a network you trust.

## Protections

- Hooks and events (`POST /event`, `/hook/*`) must carry the office key (`X-Office-Key`, the contents of `data/token`). Without it: 403.
- Process-control routes (`/api/sys/*`) and phone settings answer only requests from this computer. A foreign web page cannot call them (origin check).
- Phones: a random 8-digit PIN (8 to 10 digits if you choose your own, no easy ones), lock-out after five wrong tries, device cookie for 30 days.
- Text that looks like a password, token or API key is masked before it is stored or shown.
- Google translation is off by default (it would send descriptions of Claude's actions to Google).
- The Chat tool `office_report` sends a title, a project name and a short note only. The office does not read your claude.ai account.

- The assistants (`/api/assistants`): their ledger and chats are kept in `data/assistants/` (never commit it). A question sends Claude Code the ledger's titles, projects and short notes of that assistant's area and your last turns with it, never the conversations. Answers run with no tools at all. A job runs Claude Code in the assistant's working folder, which only this computer can set. With no one to approve, it is allowed to read, search the web, and create or change files in that folder, and nothing else: no commands.
## Your responsibilities

- Never commit or share the `data/` folder. It holds the key (`data/token`), the PIN, your project list and the group chat.
- `cowork-plugin.plugin` contains your office key: do not share or commit it.
- `node bin/cli.mjs chat-setup --write` and `install` change your Claude app / Claude Code configuration (a backup is made first). Review what they print.
- Install with `npm ci --ignore-scripts`.

## Reporting a problem

Please do not open a public issue for a vulnerability. Use GitHub's private vulnerability reporting on the repository (Security → Report a vulnerability), or contact the maintainer privately. Include the steps, the version and what you saw. Fixes are made on a branch and released with a note in [CHANGELOG.md](CHANGELOG.md).
