#!/usr/bin/env python3
"""Load bounded, scoped startup context and emit Claude hook responses."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import NamedTuple

TOTAL_TIMEOUT_SECONDS = 10.0
ATTEMPT_TIMEOUT_SECONDS = 7.0
MAX_RESPONSE_BYTES = 64 * 1024
COMPACT_GUIDANCE = """Context was compacted. If you discovered important insights,
save them before continuing:
nmem m add "<insight>" --title "<short title>" --importance 0.8"""
ROUTING_GUIDANCE = """[Nowledge Mem] For continuation, review, regression, release,
connector, prior-decision, cross-tool, or exact-history work, run one targeted
memory or thread search before concluding. Startup Context Bundle / Working
Memory is a briefing, not a substitute for that search. Use
nmem --json m search "query" -n 5 for durable knowledge, or
nmem --json t search "query" --limit 5 for prior conversations; inspect only
relevant results. Keep the configured identity and Space. If NMEM_CLI_PATH is
set, use its quoted value as the executable. If an AI Identity resolved a lane
and no NMEM_SPACE override is set, pass that existing lane with --space.
If retrieval is unavailable, say so briefly and continue; do not report a
failed search as no matches.
Before searching, briefly tell the user what prior context you are looking for.
Skip retrieval for trivial, independent tasks or an explicit fresh start.
Save durable decisions and learnings autonomously with
nmem m add "content" -t "Title" -i 0.8. For recurring procedural work, check
managed skills with MCP find_skills or nmem skills match "task"; after using
one, report with report_skill_outcome or nmem skills outcome <id>.
"""
# Repeated on every prompt and retained in the transcript, so keep it to the
# routing decision. Startup and compaction carry the full guidance above.
PROMPT_GUIDANCE = """[Nowledge Mem] For continuation, review, regression, release,
connector, prior-decision, cross-tool, or exact-history work, run one targeted
nmem memory or thread search before concluding; the startup briefing is
not a substitute. Keep the configured identity and Space. If retrieval fails,
say so briefly; do not report a failed search as no matches.
"""


class ContextRead(NamedTuple):
    content: str
    source: str
    reason: str = ""


def is_grok_runtime() -> bool:
    root = os.environ.get("CLAUDE_PLUGIN_ROOT", "").replace("\\", "/")
    return (
        any(
            os.environ.get(name)
            for name in (
                "GROK_SESSION_ID",
                "GROK_HOOK_EVENT",
                "GROK_WORKSPACE_ROOT",
                "GROK_PLUGIN_ROOT",
            )
        )
        or "/.grok/" in root
        or root.endswith("/.grok")
    )


def find_nmem() -> str | None:
    configured = os.environ.get("NMEM_CLI_PATH", "").strip()
    if configured:
        candidate = os.path.expandvars(os.path.expanduser(configured))
        return shutil.which(candidate)
    for name in ("nmem", "nmem.cmd", "nmem.exe"):
        if command := shutil.which(name):
            return command
    home = Path.home()
    candidates = [
        home / ".local/share/nowledge-mem/bin/nmem-wrapper",
        home / ".local/bin/nmem",
        Path("/usr/local/bin/nmem"),
        Path("/opt/homebrew/bin/nmem"),
    ]
    if local_app_data := os.environ.get("LOCALAPPDATA"):
        candidates.extend(
            [
                Path(local_app_data) / "Nowledge Mem CLI/bin/nmem.cmd",
                Path(local_app_data) / "Programs/Nowledge Mem/cli/nmem.cmd",
            ]
        )
    return next((str(path) for path in candidates if shutil.which(str(path))), None)


def escape_cmd_meta(value: str) -> str:
    return re.sub(r'([()%!^"<>&|;, *?])', r"^\1", value)


def batch_argument(value: str) -> str:
    value = re.sub(r'(\\*)"', lambda match: match[1] * 2 + '\\"', value)
    value = re.sub(r"(\\+)$", lambda match: match[1] * 2, value)
    # Batch shims parse arguments in cmd /c and again when forwarding %*.
    return escape_cmd_meta(escape_cmd_meta(f'"{value}"'))


def command_args(nmem: str, args: list[str]) -> list[str] | str:
    # WSL needs Windows interop, using an argument list rather than shell text.
    if nmem.lower().endswith(".cmd") and (
        os.environ.get("WSL_DISTRO_NAME") or os.environ.get("WSL_INTEROP")
    ):
        if nmem.startswith("/mnt/") and len(nmem) > 7 and nmem[6] == "/":
            nmem = nmem[5].upper() + ":\\" + nmem[7:].replace("/", "\\")
        command = subprocess.list2cmdline([nmem, *args])
        return ["cmd.exe", "/d", "/s", "/c", f'"{command}"']
    if sys.platform == "win32" and nmem.lower().endswith(".cmd"):
        command = escape_cmd_meta(nmem.replace("/", "\\"))
        command += " " + " ".join(batch_argument(arg) for arg in args)
        shell = subprocess.list2cmdline([os.environ.get("COMSPEC", "cmd.exe")])
        # A string avoids Python applying CRT quoting to cmd's command text.
        return f'{shell} /d /v:off /s /c "{command}"'
    return [nmem, *args]


def read_json(nmem: str, args: list[str], timeout: float) -> tuple[dict, str]:
    kwargs = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    try:
        result = subprocess.run(
            command_args(nmem, ["--json", *args]),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
            **kwargs,
        )
    except subprocess.TimeoutExpired:
        return {}, "timeout"
    except OSError:
        return {}, "cli_unavailable"
    if result.returncode != 0:
        return {}, "cli_error"
    if len(result.stdout.encode("utf-8")) > MAX_RESPONSE_BYTES:
        return {}, "response_too_large"
    try:
        payload = json.loads(result.stdout)
    except (ValueError, TypeError):
        return {}, "invalid_response"
    if not isinstance(payload, dict):
        return {}, "invalid_response"
    if (
        payload.get("success") is False
        or payload.get("error")
        or payload.get("error_code")
    ):
        return {}, "cli_error"
    return payload, ""


def space_args() -> list[str]:
    if space := os.environ.get("NMEM_SPACE", "").strip():
        return ["--space", space]
    if space_id := os.environ.get("NMEM_SPACE_ID", "").strip():
        return ["--space-id", space_id]
    return []


def local_fallback() -> str:
    scope = space_args()
    # Explicit lanes and identities must never inherit another lane's file.
    if (scope and scope[1].lower() != "default") or any(
        os.environ.get(name)
        for name in (
            "NMEM_AGENT_ID",
            "NMEM_HOST_AGENT_ID",
            "NMEM_APP_DATA",
            "NMEM_APP_CONFIG_DIR",
            "NMEM_CLI_CONFIG_DIR",
        )
    ):
        return ""
    folder = os.environ.get("NMEM_AI_NOW_HOME")
    if folder is not None and not folder.strip():
        return ""
    path = Path(folder).expanduser() if folder else Path.home() / "ai-now"
    try:
        return (path / "memory.md").read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        return ""


def load_context(total_timeout: float = TOTAL_TIMEOUT_SECONDS) -> ContextRead:
    reason = "cli_unavailable"
    nmem = find_nmem()
    if nmem:
        scope = space_args()
        context_args = ["context", "--source-app", "claude-code"]
        for env_name, flag in (
            ("NMEM_AGENT_ID", "--agent-id"),
            ("NMEM_HOST_AGENT_ID", "--host-agent-id"),
        ):
            if value := os.environ.get(env_name, "").strip():
                context_args.extend([flag, value])
        attempts = [(context_args + scope, "Context Bundle")]
        # Without a resolved lane, an identity-owned context cannot fall back
        # to an anonymous default-space Working Memory read.
        if scope or not any(
            os.environ.get(key) for key in ("NMEM_AGENT_ID", "NMEM_HOST_AGENT_ID")
        ):
            attempts.append((["wm", "read", *scope], "Working Memory"))
        deadline = time.monotonic() + total_timeout
        for args, source in attempts:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                reason = "timeout"
                break
            payload, error = read_json(
                nmem, args, min(ATTEMPT_TIMEOUT_SECONDS, remaining)
            )
            if error:
                reason = error
                continue
            if payload.get("exists") is False:
                reason = "no_briefing"
                continue
            for key in ("rendered_markdown", "content"):
                content = payload.get(key)
                if isinstance(content, str) and content.strip():
                    return ContextRead(content.strip(), source)
            reason = (
                "no_briefing"
                if any(
                    isinstance(payload.get(key), str)
                    for key in ("rendered_markdown", "content")
                )
                else "invalid_response"
            )
    if content := local_fallback():
        return ContextRead(content, "legacy Default-space briefing")
    return ContextRead("", "", reason)


def write_response(event: str, content: str, message: str = "") -> None:
    response = {
        "hookSpecificOutput": {
            "hookEventName": event,
            "additionalContext": content,
        },
    }
    if message:
        response["systemMessage"] = message
    json.dump(response, sys.stdout, ensure_ascii=True)
    sys.stdout.write("\n")


def main(
    *,
    event: str = "SessionStart",
    raw: bool = False,
    compact: bool = False,
    timeout: float = TOTAL_TIMEOUT_SECONDS,
) -> int:
    # Grok discards passive hook stdout; keep its model-invoked skill path.
    if is_grok_runtime():
        return 0
    if event == "UserPromptSubmit":
        write_response(event, PROMPT_GUIDANCE.strip())
        return 0
    result = load_context(timeout)
    if raw:
        if result.content:
            print(result.content)
        return 0
    content = ROUTING_GUIDANCE.strip()
    if result.content:
        content += "\n\n## Current Nowledge context\n\n" + result.content
        message = f"[Nowledge Mem] Loaded session context: {result.source}."
    elif result.reason == "no_briefing":
        message = "[Nowledge Mem] No startup briefing available. Targeted search remains available."
    else:
        message = f"[Nowledge Mem] Startup context unavailable ({result.reason}). Check /nowledge-mem:status."
    if compact:
        content += "\n\n" + COMPACT_GUIDANCE
    write_response(event, content, message)
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--event", choices=("SessionStart", "UserPromptSubmit"), default="SessionStart"
    )
    parser.add_argument("--raw", action="store_true")
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--timeout", type=float, default=TOTAL_TIMEOUT_SECONDS)
    options = parser.parse_args()
    try:
        # Raw subagent context is decoded as UTF-8 even on Windows pipes.
        sys.stdout.reconfigure(encoding="utf-8")
        raise SystemExit(
            main(
                event=options.event,
                raw=options.raw,
                compact=options.compact,
                timeout=options.timeout,
            )
        )
    except Exception:  # noqa: BLE001 - Lifecycle hooks must fail open.
        if not options.raw and not is_grok_runtime():
            write_response(
                options.event,
                PROMPT_GUIDANCE.strip()
                if options.event == "UserPromptSubmit"
                else ROUTING_GUIDANCE.strip(),
                "[Nowledge Mem] Startup context unavailable. Check /nowledge-mem:status."
                if options.event == "SessionStart"
                else "",
            )
        raise SystemExit(0)
