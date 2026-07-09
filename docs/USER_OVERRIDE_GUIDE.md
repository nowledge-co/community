# User Override Guide

How users should customize a Nowledge Mem integration without losing those changes on the next plugin update.

## Core rule

Do **not** edit installed plugin files in a marketplace cache or plugin directory.

Use the host's own user-owned instruction surface instead. That is the only override path we should recommend long-term.

## Override surfaces by host

| Host | Use this for shared repo rules | Use this for personal/local rules | Notes |
|------|-------------------------------|-----------------------------------|-------|
| Codex | `AGENTS.md` | same `AGENTS.md` in the repo you care about | The package `AGENTS.md` is source text to merge, not a file to patch under the installed plugin. |
| Claude Code | `CLAUDE.md` | `CLAUDE.local.md` | Prefer `CLAUDE.local.md` for your own memory-behavior tweaks that should not enter git. |
| Grok | Grok project rules / `Agents.md` | repo-local project rules | Keep installed plugin files untouched; put behavior changes in the project rules Grok already reads. |
| Copilot CLI | `.github/copilot-instructions.md` or `.github/instructions/*.instructions.md` | `~/.copilot/copilot-instructions.md` | Use Copilot's native instruction picker and file discovery instead of editing plugin hooks. |
| Cursor | `.cursor/rules/*.mdc` or `.cursorrules` | repo-local rule files | Keep the plugin's bundled rule as the default. Add your own rule file beside it. |
| Gemini CLI | `GEMINI.md` in the repo root | `~/.gemini/GEMINI.md` | Use `@file.md` imports to keep large customizations modular. |
| Hermes | `HERMES.md` | `~/.hermes/SOUL.md` | SOUL is the reliable always-loaded personal layer. |
| OpenCode | `AGENTS.md` or files listed in `opencode.json` `instructions` | `~/.config/opencode/AGENTS.md` | OpenCode can combine explicit instruction files cleanly. |
| Pi | `AGENTS.md` next to the project config | repo-local `AGENTS.md` | Pi package skills stay default; project guidance is the real override path. |
| Kimi Code | project `AGENTS.md` or `.kimi-code/AGENTS.md` | `$KIMI_CODE_HOME/AGENTS.md` | Keep the managed plugin copy untouched; Kimi Code loads user and project instructions outside the plugin. |
| Craft Agent | Workspace `skills/{slug}/SKILL.md` or `sources/{slug}/guide.md` | Global `~/.agents/skills/{slug}/SKILL.md` | Keep the community connector templates as defaults; put durable behavior changes in Craft's own source guide or skill files. |
| WorkBuddy | project `CODEBUDDY.md` or `.workbuddy/rules/*.md` if exposed by the workspace | `~/.workbuddy/CODEBUDDY.md`, `~/.workbuddy/MEMORY.md`, or `$WORKBUDDY_CONFIG_DIR/CODEBUDDY.md` | Keep the plugin package untouched; WorkBuddy has its own `.workbuddy` config directory separate from CodeBuddy. |
| CodeBuddy | project `CODEBUDDY.md` or `.codebuddy/rules/*.md` | `~/.codebuddy/CODEBUDDY.md` or `$CODEBUDDY_CONFIG_DIR/CODEBUDDY.md` | Keep the plugin package untouched; CodeBuddy loads user/project memory and rules outside marketplace installs. |

## Integrations without a first-class override file

These integrations currently do not have a clean user-owned rule file in our package contract:

- OpenClaw
- Alma
- Bub
- Droid
- Raycast

For these, use the host's own custom system prompt, settings UI, or plugin config fields. Do not patch installed plugin source.

## What not to do

- Do not edit files under `~/.codex/...`, `~/.copilot/installed-plugins/...`, `~/.cursor/plugins/...`, `~/.hermes/plugins/...`, or similar install roots.
- Do not edit bundled skills in-place and expect updates to preserve those changes.
- Do not introduce a fake `AGENTS.override.md` filename unless the host actually supports it.

## Product rule

Whenever a host supports a real instruction layer, Nowledge Mem docs should lead users there first.
