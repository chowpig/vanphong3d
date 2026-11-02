# Cowork plugin for the office

Sends a Cowork session's events (start, prompts, tool calls, stop) to the office on this computer, marked as Cowork, so
the session shows as a character named "Cowork · …" in its project's area.

**Status: not verified.** It reuses the Claude Code hooks, but nobody has yet confirmed that a Cowork session (which runs
in a virtual machine) can reach the office at `127.0.0.1:4310` from inside it. If the hooks do not arrive, the office
shows nothing for Cowork and nothing else breaks. Cowork's own files are not read.

1. Copy `data/token` (made when the office first ran) to `cowork-plugin/data/token`. Never commit it.
2. Install this folder as a plugin in Cowork yourself (Customize → plugins): it changes your own configuration, so the
   office does not do it for you.
3. Start a Cowork task and watch the office. `/api/doctor` shows `lastEventAt` moving when an event arrives.
