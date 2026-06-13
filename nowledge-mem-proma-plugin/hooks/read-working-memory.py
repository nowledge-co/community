#!/usr/bin/env python3
"""Read Nowledge Mem context for Proma startup and asyncRewake hooks.

Proma's current Claude Agent SDK does not reliably inject SessionStart stdout
as additional context. For startup, this hook writes a marked Nowledge Mem block
into Proma's workspace CLAUDE.md, which Proma loads naturally. For asyncRewake,
it prints a compact Working Memory reminder and exits 2 only when there is
context worth injecting.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

START_MARKER = "<!-- nowledge-mem:start -->"
END_MARKER = "<!-- nowledge-mem:end -->"


def _env_path(name: str, default: Path) -> Path:
    raw = os.environ.get(name)
    if isinstance(raw, str) and raw.strip():
        return Path(raw.strip()).expanduser()
    return default.expanduser()


PROMA_HOME = _env_path("PROMA_HOME", Path.home() / ".proma")
PROMA_WORKSPACE_DIR = _env_path("PROMA_WORKSPACE_DIR", PROMA_HOME / "agent-workspaces" / "default")
CLAUDE_MD = _env_path("PROMA_CLAUDE_MD", PROMA_WORKSPACE_DIR / "CLAUDE.md")
CLAUDE_TEMPLATE = _env_path("PROMA_CLAUDE_TEMPLATE", PROMA_WORKSPACE_DIR / "CLAUDE.md.template")
LOG_DIR = PROMA_HOME / "logs"
LOG_FILE = LOG_DIR / "nm-hooks.log"


def log(msg: str) -> None:
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(f"[{ts}] read-working-memory {msg}\n")
    except Exception:
        pass


def _nmem_command_prefix() -> list[str] | None:
    found = shutil.which("nmem") or shutil.which("nmem.cmd")
    if found:
        return [found]

    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Nowledge Mem" / "cli" / "nmem.cmd",
        Path.home() / ".pixi" / "envs" / "python" / "Scripts" / "nmem.exe",
    ]
    for path in candidates:
        if path.exists():
            return [str(path)]

    uvx = shutil.which("uvx")
    if uvx:
        return [uvx, "--from", "nmem-cli", "nmem"]
    return None


def _run_nmem_json(args: list[str], label: str, timeout: int = 15) -> dict[str, Any] | None:
    prefix = _nmem_command_prefix()
    if not prefix:
        log("nmem CLI not found")
        return None

    cmd = [*prefix, "--json", *args]
    if Path(prefix[0]).name.lower().endswith(".cmd"):
        cmd = ["cmd.exe", "/d", "/c", "call", *cmd]

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            check=False,
        )
        if proc.returncode != 0:
            log(f"{label} exit={proc.returncode} stderr={proc.stderr.strip()[:240]}")
            return None
        raw = proc.stdout.strip()
        if not raw:
            return None
        loaded = json.loads(raw)
        return loaded if isinstance(loaded, dict) else None
    except subprocess.TimeoutExpired:
        log(f"{label} timed out")
        return None
    except Exception as exc:
        log(f"{label} error: {exc}")
        return None


def _env_value(name: str) -> str:
    return os.environ.get(name, "").strip()


def _context_args() -> list[str]:
    args = ["context", "--source-app", "proma"]
    agent_id = _env_value("NMEM_AGENT_ID")
    host_agent_id = _env_value("NMEM_HOST_AGENT_ID")
    space = _env_value("NMEM_SPACE") or _env_value("NMEM_SPACE_ID")
    if agent_id:
        args.extend(["--agent-id", agent_id])
    if host_agent_id:
        args.extend(["--host-agent-id", host_agent_id])
    if space:
        args.extend(["--space", space])
    return args


def _working_memory_args() -> list[str]:
    args = ["wm", "read"]
    space = _env_value("NMEM_SPACE") or _env_value("NMEM_SPACE_ID")
    if space:
        args.extend(["--space", space])
    return args


def _payload_text(payload: dict[str, Any] | None) -> str:
    if not payload:
        return ""

    for key in ("rendered_markdown", "markdown", "content", "text"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    working_memory = payload.get("working_memory")
    if isinstance(working_memory, dict):
        value = working_memory.get("content")
        if isinstance(value, str) and value.strip():
            return value.strip()

    context = payload.get("context")
    if isinstance(context, str) and context.strip():
        return context.strip()

    return ""


def _startup_context() -> dict[str, Any] | None:
    context = _run_nmem_json(_context_args(), "nmem context")
    if context is not None:
        return context
    return _run_nmem_json(_working_memory_args(), "nmem wm read")


def _managed_block(context_markdown: str) -> str:
    generated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return (
        f"{START_MARKER}\n"
        "## Nowledge Mem Context\n\n"
        f"_Updated automatically by the Nowledge Mem Proma plugin at {generated}._\n\n"
        "Use this context before planning, writing, or deciding. Search Nowledge Mem "
        "with `mcp__nowledge-mem__*` tools when the task depends on past decisions, "
        "brand rules, preferences, or earlier Proma conversations.\n\n"
        f"{context_markdown.strip()}\n"
        f"{END_MARKER}"
    )


def _base_claude_md() -> str:
    if CLAUDE_MD.exists():
        return CLAUDE_MD.read_text(encoding="utf-8")
    if CLAUDE_TEMPLATE.exists():
        return CLAUDE_TEMPLATE.read_text(encoding="utf-8")
    return (
        "# Proma Workspace Instructions\n\n"
        "This file is loaded by Proma when a workspace session starts. "
        "Add your stable project guidance above or below the Nowledge Mem block.\n"
    )


def render_claude_md(base: str, context_markdown: str) -> str:
    block = _managed_block(context_markdown)
    if START_MARKER in base and END_MARKER in base:
        before, rest = base.split(START_MARKER, 1)
        _, after = rest.split(END_MARKER, 1)
        after = after.lstrip("\n\r")
        return f"{before.rstrip()}\n\n{block}\n{after}".rstrip() + "\n"
    return f"{base.rstrip()}\n\n{block}\n"


def update_claude_md(context_markdown: str) -> bool:
    if not context_markdown.strip():
        return False
    try:
        CLAUDE_MD.parent.mkdir(parents=True, exist_ok=True)
        rendered = render_claude_md(_base_claude_md(), context_markdown)
        CLAUDE_MD.write_text(rendered, encoding="utf-8")
        log(f"updated CLAUDE.md path={CLAUDE_MD}")
        return True
    except Exception as exc:
        log(f"failed to update CLAUDE.md: {exc}")
        return False


def _print_rewake() -> int:
    payload = _run_nmem_json(_working_memory_args(), "nmem wm read", timeout=10)
    text = _payload_text(payload)
    if not text:
        log("rewake: no working memory")
        return 0

    print("## Nowledge Mem Working Memory")
    print()
    print(text)
    log("rewake: emitted working memory")
    return 2


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rewake", action="store_true", help="Emit compact Working Memory for asyncRewake")
    args = parser.parse_args()

    if args.rewake:
        return _print_rewake()

    log("startup context refresh start")
    payload = _startup_context()
    text = _payload_text(payload)
    if not text:
        log("startup context refresh: no data")
        print(json.dumps({"status": "empty"}))
        return 0

    ok = update_claude_md(text)
    print(json.dumps({"status": "updated" if ok else "failed", "path": str(CLAUDE_MD)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
