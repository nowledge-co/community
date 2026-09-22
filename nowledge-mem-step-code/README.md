# Nowledge Mem for Step Code

Cross-tool memory for Step Code. Start with your current Mem context, search and save durable knowledge through skills, and keep completed Step Code conversations available in every other connected tool.

## Install

Prerequisites: Nowledge Mem App or a configured remote Mem server, and `nmem` available in the shell that launches Step Code.

```bash
nmem status
step install npm:nowledge-mem-step-code
```

Restart Step Code after install or update.

Update only this package later with:

```bash
step update npm:nowledge-mem-step-code
```

## What You Get

- Context Bundle or Working Memory injected before the first agent turn
- Automatic capture after Step Code's `agent_settled` event, after retries, compaction, and queued continuations have finished
- Final bounded flushes before compaction, session switches, and shutdown
- Five skills for context, search, distillation, explicit handoffs, and status
- Local App and remote/Cloud support through the shared `nmem` client configuration

## Verify

Start a new Step Code session and ask it to check Nowledge Mem status. Then complete one short exchange and run:

```bash
nmem t list --source step-code -n 5
```

## Import Older Sessions

```bash
nmem t sync --from step-code --limit 20
nmem t sync --from step-code --apply
```

The import reads Step Code's native JSONL sessions under `~/.stepcode/agent/sessions` (or its configured session directory). Preview is the default, and reruns converge on the same threads.

## Remote Configuration

```bash
nmem config client set url https://your-server
nmem config client set api-key your-key
```

Environment overrides such as `NMEM_API_URL`, `NMEM_API_KEY`, `NMEM_SPACE`, and `NMEM_AGENT_ID` remain available for one process or a durable agent identity.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/step-code)
- [All connectors](https://mem.nowledge.co/docs/integrations)
