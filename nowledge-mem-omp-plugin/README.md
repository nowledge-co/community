# Nowledge Mem for OMP

Cross-tool memory for OMP. Your decisions, preferences, and procedures persist across sessions and across every AI tool you use.

## What You Get

OMP gains a native extension plus five skills:

- Completed OMP conversations sync into Nowledge Mem as searchable threads
- Context Bundle or Working Memory is injected at startup when available
- Search, thread lookup, and distillation stay available through skills and the `nmem` CLI
- Remote Mem works through shared `nmem` client config or `NMEM_API_URL` / `NMEM_API_KEY`

## Prerequisites

1. Nowledge Mem desktop app running, or a remote server.
2. `nmem` CLI in your PATH:

```bash
nmem status
```

## Install

```bash
omp plugin install nowledge-mem-omp
```

For local development:

```bash
omp plugin link /path/to/community/nowledge-mem-omp-plugin
```

## Verify

Start an OMP session and check connectivity:

```text
check my Nowledge Mem status
```

Then have a short OMP exchange and check recent threads:

```bash
nmem t list --source omp -n 5
```

To confirm startup context injection, start a new OMP session and ask what Nowledge Mem context was provided. OMP should reference the injected Context Bundle or Working Memory without needing to run the `read-working-memory` skill again.

## Import Older OMP Sessions

The extension keeps new OMP conversations synced automatically. To backfill sessions that happened before you installed the package, preview and then import:

```bash
nmem t sync --from omp --limit 20
nmem t sync --from omp --apply
```

This command reads local OMP JSONL sessions from the OMP machine and uploads normalized threads through the configured Mem API. It is safe to rerun.

## Customize without editing the package

Use your project's own OMP instruction surface, such as project `.omp/AGENTS.md` or the normal OMP config files, as the override layer.

- Keep the package skills as shipped defaults
- Copy or merge the package `AGENTS.md` into your project config area if you want durable team guidance
- Do not patch installed package files under the OMP plugin cache

## Troubleshooting

**nmem not found:** Install or update the Nowledge Mem CLI, then confirm `nmem status` works in the same shell that launches OMP.

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server.

**Remote setup:** Prefer `nmem config client set url ...` and `nmem config client set api-key ...`, or set `NMEM_API_URL` and `NMEM_API_KEY` for the OMP process.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/omp)
- [All Connectors](https://mem.nowledge.co/docs/integrations)
- [GitHub](https://github.com/nowledge-co/community)
