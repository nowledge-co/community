#!/usr/bin/env python3
"""Preview or save Hermes Studio coding-agent sessions to Nowledge Mem.

Hermes Studio runs external coding agents such as Codex and Claude Code through
its own `coding-agent-run` wrapper. Those runs are persisted in the Hermes Web
UI database, but the wrapper may not trigger the agent's native Stop hooks. This
helper bridges the gap by mapping a Hermes Studio session id to the underlying
agent transcript and then running the existing `nmem threads save` command.

Examples:
  python scripts/sync_hermes_studio_coding_agent.py --session-id mr3eiohc924sn8
  python scripts/sync_hermes_studio_coding_agent.py --session-id mr3eiohc924sn8 --apply
  python scripts/sync_hermes_studio_coding_agent.py --all --since-lines 5000 --apply
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import os
import re
from pathlib import Path
import subprocess
import sys
from typing import Iterable


@dataclasses.dataclass
class RunRecord:
    hermes_session_id: str
    agent_id: str
    run_id: str = ""
    native_session_id: str = ""
    started_ms: int = 0
    exited_ms: int = 0
    code: int | None = None

    @property
    def nmem_source(self) -> str:
        if self.agent_id == "codex":
            return "codex"
        if self.agent_id == "claude-code":
            return "claude-code"
        return self.agent_id


def default_webui_home() -> Path:
    return Path(os.environ.get("HERMES_WEB_UI_HOME") or Path.home() / ".hermes-web-ui").expanduser()


def default_codex_home(webui_home: Path) -> Path | None:
    root = webui_home / "coding-agent" / "model"
    if not root.exists():
        return None
    candidates = sorted(root.glob("*/*/codex"), key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)
    return candidates[0] if candidates else None


def iter_json_log_lines(path: Path, since_lines: int = 0) -> Iterable[dict]:
    if not path.exists():
        return
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    if since_lines > 0:
        lines = lines[-since_lines:]
    for line in lines:
        try:
            data = json.loads(line)
        except Exception:
            continue
        if isinstance(data, dict):
            yield data


def parse_server_log(path: Path, since_lines: int = 0) -> dict[str, RunRecord]:
    records: dict[str, RunRecord] = {}
    by_run: dict[str, RunRecord] = {}
    for entry in iter_json_log_lines(path, since_lines=since_lines):
        msg = str(entry.get("msg") or "")
        session_id = str(entry.get("sessionId") or "")
        run_id = str(entry.get("runId") or "")
        if not session_id:
            continue
        if "[coding-agent-run] print runner started" in msg:
            agent_id = str(entry.get("agentId") or "")
            rec = records.get(session_id) or RunRecord(hermes_session_id=session_id, agent_id=agent_id, run_id=run_id)
            rec.agent_id = agent_id or rec.agent_id
            rec.run_id = run_id or rec.run_id
            rec.started_ms = int(entry.get("time") or rec.started_ms or 0)
            records[session_id] = rec
            if run_id:
                by_run[run_id] = rec
        elif "recorded Codex native session id" in msg:
            rec = by_run.get(run_id) or records.get(session_id) or RunRecord(hermes_session_id=session_id, agent_id="codex", run_id=run_id)
            rec.agent_id = rec.agent_id or "codex"
            rec.native_session_id = str(entry.get("nativeSessionId") or rec.native_session_id or "")
            rec.started_ms = rec.started_ms or int(entry.get("time") or 0)
            records[session_id] = rec
            if run_id:
                by_run[run_id] = rec
        elif "[coding-agent-run] codex exec exited" in msg or "[coding-agent-run] claude print exited" in msg:
            rec = by_run.get(run_id) or records.get(session_id)
            if rec is None:
                agent_id = "codex" if "codex exec" in msg else "claude-code"
                rec = RunRecord(hermes_session_id=session_id, agent_id=agent_id, run_id=run_id)
            rec.exited_ms = int(entry.get("time") or rec.exited_ms or 0)
            code = entry.get("code")
            rec.code = int(code) if isinstance(code, int) else rec.code
            records[session_id] = rec
            if run_id:
                by_run[run_id] = rec
    return records


def claude_project_dirs_for_cwd(cwd: Path) -> list[Path]:
    raw = str(cwd)
    # Claude Code currently normalizes project paths by replacing path
    # separators and punctuation with dashes. Keep the older slash-only form as
    # a fallback for compatibility with historical transcripts.
    normalized = re.sub(r"[^A-Za-z0-9-]", "-", raw.replace("/", "-"))
    slash_only = raw.replace("/", "-")
    base = Path.home() / ".claude" / "projects"
    dirs = [base / normalized]
    if slash_only != normalized:
        dirs.append(base / slash_only)
    return dirs


def infer_claude_session_id(rec: RunRecord, cwd: Path) -> str:
    """Best-effort inference for Hermes Studio `claude print` one-shot runs.

    Hermes Studio logs do not currently record Claude Code's native session id.
    Claude Code writes a JSONL transcript under ~/.claude/projects/<cwd-slug>/.
    Pick the transcript with mtime closest to the wrapper's exit time.
    """
    project_dirs = [path for path in claude_project_dirs_for_cwd(cwd) if path.exists()]
    if not project_dirs:
        return ""
    target = (rec.exited_ms or rec.started_ms) / 1000 if (rec.exited_ms or rec.started_ms) else 0
    best: tuple[float, Path] | None = None
    for project_dir in project_dirs:
        for path in project_dir.glob("*.jsonl"):
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            # Keep a broad window for delayed Web UI flushes and clock skew.
            if target and abs(mtime - target) > 3600:
                continue
            score = abs(mtime - target) if target else -mtime
            if best is None or score < best[0]:
                best = (score, path)
    return best[1].stem if best else ""


def build_command(rec: RunRecord, native_session_id: str, truncate: bool) -> list[str]:
    cmd = ["nmem", "threads", "save", "--from", rec.nmem_source]
    if truncate:
        cmd.append("--truncate")
    if native_session_id:
        cmd.extend(["--session-id", native_session_id])
    return cmd


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--session-id", help="Hermes Studio session id, e.g. mr3eoys1vax19g")
    parser.add_argument("--all", action="store_true", help="Preview/apply all discovered coding-agent sessions in recent logs")
    parser.add_argument("--apply", action="store_true", help="Run nmem; otherwise only print the command")
    parser.add_argument("--truncate", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--webui-home", type=Path, default=default_webui_home())
    parser.add_argument("--server-log", type=Path, help="Path to Hermes Web UI server.log")
    parser.add_argument("--cwd", type=Path, default=Path.cwd(), help="Project cwd used by the coding agent")
    parser.add_argument("--codex-home", type=Path, help="CODEX_HOME for Hermes Studio Codex runtime")
    parser.add_argument("--since-lines", type=int, default=20000, help="Only parse the last N server.log lines")
    args = parser.parse_args()

    if not args.session_id and not args.all:
        parser.error("provide --session-id or --all")

    server_log = args.server_log or args.webui_home / "logs" / "server.log"
    records = parse_server_log(server_log, since_lines=args.since_lines)
    selected = list(records.values()) if args.all else [records.get(args.session_id or "")]
    selected = [r for r in selected if r and r.agent_id in {"codex", "claude-code"}]
    if not selected:
        print(json.dumps({"status": "not_found", "session_id": args.session_id, "server_log": str(server_log)}, ensure_ascii=False), file=sys.stderr)
        return 2

    codex_home = args.codex_home or default_codex_home(args.webui_home)
    failures = 0
    for rec in selected:
        native_session_id = rec.native_session_id
        if rec.agent_id == "claude-code" and not native_session_id:
            native_session_id = infer_claude_session_id(rec, args.cwd)
        cmd = build_command(rec, native_session_id, args.truncate)
        payload = dataclasses.asdict(rec)
        payload.update({"native_session_id": native_session_id, "command": cmd, "apply": args.apply})
        if not native_session_id:
            payload["warning"] = "native session id could not be inferred; command may save the latest session for the project"
        print(json.dumps(payload, ensure_ascii=False))
        if args.apply:
            env = os.environ.copy()
            if rec.agent_id == "codex" and codex_home:
                env["CODEX_HOME"] = str(codex_home)
            result = subprocess.run(cmd, cwd=str(args.cwd), env=env, text=True)
            if result.returncode != 0:
                failures += 1
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
