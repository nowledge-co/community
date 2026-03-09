# Nowledge Mem -- Gemini CLI Extension

> Bring your Nowledge Mem knowledge base into Gemini CLI with persistent context, reusable slash commands, and agent skills.

This package is the **Gemini-native product surface** for Nowledge Mem.

It is deliberately **CLI-first**:

- Gemini CLI loads `GEMINI.md` plus extension hooks for Working Memory bootstrap and session capture
- bundled commands wrap common `nmem` workflows
- bundled skills teach Gemini when to recall, distill, save real threads, and create handoff summaries
- Gemini can still call `nmem` directly whenever it needs a more flexible path

The recommended Gemini setup is deliberately simple and stable: Gemini CLI on top, `nmem` underneath. That keeps auth, debugging, and command composition in one place.

## Requirements

- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [Nowledge Mem](https://mem.nowledge.co) running locally, or a reachable remote Nowledge Mem server
- `nmem` CLI in your `PATH`

If Nowledge Mem is already running on the same machine through the desktop app, the cleanest setup is to install the bundled CLI from **Settings -> Preferences -> Developer Tools -> Install CLI**. That gives Gemini direct access to the local Mem instance without any remote configuration.

You can also install `nmem` standalone:

```bash
# Option 1: pip
pip install nmem-cli

# Option 2: uvx
curl -LsSf https://astral.sh/uv/install.sh | sh
uvx --from nmem-cli nmem --version
```

Verify the connection:

```bash
nmem status
```

For the default same-machine setup, `nmem status` should show `http://127.0.0.1:14242 (default)`. No `~/.nowledge-mem/config.json` is required unless you are connecting to a remote Mem server.

## Install

Until this extension ships as a standalone Gemini extension package, install it from a local checkout:

```bash
git clone https://github.com/nowledge-co/community.git
cd community/nowledge-mem-gemini-cli-extension
gemini extensions link .
```

Restart Gemini CLI after linking.

Gemini's extension release flow expects `gemini-extension.json` at the root of the installable package. This directory already follows that layout, so it can later be published cleanly as its own release artifact without changing the extension design.

Release packaging and marketplace notes live in [`RELEASING.md`](./RELEASING.md).

## What You Get

**Automatic lifecycle hooks**

- Session start loads Working Memory into Gemini when a briefing exists
- Session end performs a best-effort real Gemini thread import through `nmem t save --from gemini-cli`

**Persistent context**

- `GEMINI.md` tells Gemini how to route recall across Working Memory, distilled memories, conversation threads, thread save, distillation, and handoff summaries

**Custom commands**

- `/nowledge:read-working-memory` -- Load today's Working Memory briefing
- `/nowledge:search-memory <query>` -- Search your knowledge base before answering
- `/nowledge:distill-memory` -- Save the high-value insights from the current conversation
- `/nowledge:save-thread` -- Save the real Gemini CLI session through `nmem`'s native Gemini importer
- `/nowledge:save-handoff` -- Save a concise resumable handoff summary for the current Gemini session
- `/nowledge:status` -- Check `nmem` and server connectivity

**Agent skills**

- `read-working-memory`
- `search-memory`
- `distill-memory`
- `save-thread`
- `save-handoff`

## Local vs Remote

By default, `nmem` connects to the local Mem server at `http://127.0.0.1:14242`.

For remote Mem, the preferred long-term setup is:

```json
{
  "apiUrl": "https://mem.example.com",
  "apiKey": "nmem_your_key"
}
```

Save that to:

```text
~/.nowledge-mem/config.json
```

`nmem` loads connection settings with this priority:

- `--api-url` flag
- `NMEM_API_URL` / `NMEM_API_KEY`
- `~/.nowledge-mem/config.json`
- defaults

If you need a temporary override for one Gemini session, launch Gemini from a shell where `NMEM_API_URL` and `NMEM_API_KEY` are already exported. For durable setup, keep using `~/.nowledge-mem/config.json`.

For thread save in remote mode, the important detail is that `nmem t save --from gemini-cli` reads Gemini's local session files on the machine running Gemini, then uploads the normalized thread messages to Mem. The remote Mem server does not need direct access to your `~/.gemini` directory.

## Direct `nmem` Use Is Always Allowed

The bundled commands are convenience paths, not a cage. Gemini should freely compose direct `nmem` commands when that is clearer or more flexible.

Examples:

```bash
nmem --json wm read
nmem --json m search "auth token rotation" --mode deep --importance 0.7
nmem --json m add "JWT refresh failures came from clock skew between the gateway and API nodes." -t "JWT refresh failures traced to clock skew" -i 0.9 --unit-type learning -l auth -l backend -s gemini-cli
nmem --json t save --from gemini-cli -p . -s "Finished the auth refactor and verified the new refresh-token flow."
nmem --json t create -t "Gemini CLI Session - auth refactor" -c "Goal: finish the auth refactor. Decisions: keep refresh verification in the API layer and treat gateway skew as the root cause. Files: api/auth.ts, auth.test.ts. Next: validate expiry behavior against remote sessions." -s gemini-cli
nmem status
```

## Thread Save vs Handoff

Gemini now supports two separate save paths, and they should stay distinct:

- `/nowledge:save-thread` imports the **real Gemini session messages** into Nowledge Mem with `nmem t save --from gemini-cli`. The summary is only metadata; the stored thread is based on Gemini's recorded transcript. The extension also performs this import automatically at session end as a best-effort, idempotent lifecycle hook.
- `/nowledge:save-handoff` creates a **compact resumable handoff summary** with Goal, Decisions, Files, Risks, and Next. Use this when the user wants a lightweight restart point rather than the full transcript.

Use `/nowledge:distill-memory` for durable atomic knowledge, `/nowledge:save-thread` for the full session, and `/nowledge:save-handoff` for a resumable handoff.

## Architecture Choice

This integration keeps the control plane simple:

- Gemini provides the extension surface: `GEMINI.md`, commands, and skills
- `nmem` provides the execution path: memory search, Working Memory, capture, thread import, and remote auth
- direct `nmem` composition stays available whenever Gemini needs a more flexible command path

The result is a setup that is easier to reason about, easier to support, and easier for advanced users to extend.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/gemini-cli)
- [Nowledge Mem](https://mem.nowledge.co)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)
