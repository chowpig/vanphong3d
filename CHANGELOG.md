# Changelog

Vanphong3d, a fork of [My Office](https://github.com/khanh020905/my-office). The first entry lists what this fork changed.

## 0.3.1

### Changed
- The product is now named **Nhà Gỗ Office** in the interface, the messages, the page title, the manifest and the docs. The `my-office` names of the MCP entry, the CLI command and the data keys are unchanged so existing setups keep working.

## 0.3.0

### Added
- **Chat in the office**: a local MCP tool (`mcp/office-mcp.mjs`, `office_report`) lets Claude Chat tell the office about a conversation; it appears as "Chat · title". `node bin/cli.mjs chat-setup [--write]` finds the Claude app's config (also the Microsoft Store build) and adds it, with a backup.
- **Cowork**: a plugin (`cowork-plugin/`, built with `node bin/cli.mjs cowork-plugin`) and a key-protected listener on the Hyper-V virtual adapter for Cowork's virtual machine (`OFFICE_VM_BIND=off` disables it).
- **Projects as department rooms**: Settings → Office → My projects. A conversation joins a project by name in its title or by the project it reports. Named projects always get department rooms.
- **A self-growing office** ("Auto", the default): the company floor up to 6 projects, then headquarters, then more department rows up to 18 projects.
- Chat and Cowork conversations are remembered across restarts and kept 6 hours (they used to disappear after 10 quiet minutes).
- **Camera**: the wheel zooms gently; W A S D and the arrow keys move the view (Shift is faster).
- Settings: "Also show Claude Code sessions".
- Docs: `docs/HUONG-DAN.md` (Vietnamese), `docs/GUIDE.md` (English), `SECURITY.md`.

### Changed
- Only Chat and Cowork conversations are drawn by default; Claude Code sessions are hidden unless Settings says otherwise.
- The group chat talks about the real work (task, files changed, commands, time taken) with many varied lines that do not repeat; the small talk (lunch polls, shopping, ATM, pickleball, microwaves) is gone.
- Vietnamese is the default language.
- The outdoor scenery was removed: the building, a lawn and a path round it.
- Example project names are neutral.

### Fixed
- A Windows project folder name (`~\Chat\Chat`) was used whole as the project name.
- `claude.exe` installed with npm on Windows (only a `claude.cmd` shim on the PATH) was not found, so signing in from the office failed.
- `npm start`, the CLI on Windows paths, and the hook script on Windows.
- A chat's remembered desk in the company floor kept it out of its department room after the office grew.

### Security
- The Cloudflare tunnel was removed.
- `/event` and `/hook/*` need the office key. `/api/sys/*` and phone-status routes answer this computer only. Frame, CSP and nosniff headers added.
- The Vietnamese translation service (Google) is off unless asked for.
- PIN of at least 8 digits; the device cookie lasts 30 days.

### Known limits
- A real Cowork session in the virtual machine was not verified on every setup.
- Chat appears only when it calls the tool: paste the instructions from the guide into Preferences.
- The full end-to-end suite takes about 1.5 hours on Windows, where some long simulations time out in software rendering; tests that need the bash stand-in for Claude Code skip themselves there.
- Inert code of the removed street scenes remains.
