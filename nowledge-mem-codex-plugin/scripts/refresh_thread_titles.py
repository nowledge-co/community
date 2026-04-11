#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from urllib.parse import quote

from nmem_cli import cli
from nmem_cli.session_import import parse_codex_session_streaming


SESSIONS_ROOT = Path.home() / ".codex" / "sessions"
AGENTS_PREFIX = "# AGENTS.md instructions for "
GET_TIMEOUT_SECONDS = 10.0
IMPORT_TIMEOUT_SECONDS = 120.0


def load_hook_module():
    hook_path = Path(__file__).resolve().parent.parent / "hooks" / "nmem-stop-save.py"
    spec = importlib.util.spec_from_file_location("nmem_stop_save", hook_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def iter_codex_rollouts() -> list[Path]:
    return sorted(SESSIONS_ROOT.rglob("rollout-*.jsonl"))


def get_thread(thread_id: str) -> dict | None:
    return cli.api_get_optional(
        f"/threads/{quote(thread_id, safe='')}",
        timeout=GET_TIMEOUT_SECONDS,
    )


def build_thread_payload(
    thread_id: str,
    title: str,
    messages: list[dict],
    thread: dict | None = None,
) -> dict:
    thread = thread or {}
    return {
        "thread_id": thread_id,
        "title": title,
        "source": thread.get("source") or "codex",
        "project": thread.get("project"),
        "workspace": thread.get("workspace"),
        "metadata": thread.get("metadata") or {},
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
    }


def refresh_thread(
    thread_id: str,
    title: str,
    messages: list[dict],
    dry_run: bool,
    original_title: str | None = None,
    original_messages: list[dict] | None = None,
    thread: dict | None = None,
) -> None:
    if dry_run:
        print(f"DRY RUN refresh {thread_id} -> {title}", flush=True)
        return

    encoded_thread_id = quote(thread_id, safe='')
    replacement_payload = build_thread_payload(thread_id, title, messages, thread=thread)
    cli.api_delete(f"/threads/{encoded_thread_id}")
    try:
        cli.api_post(
            "/threads",
            replacement_payload,
            timeout=IMPORT_TIMEOUT_SECONDS,
        )
    except Exception:
        if original_title is not None and original_messages is not None:
            cli.api_post(
                "/threads",
                build_thread_payload(
                    thread_id,
                    original_title,
                    original_messages,
                    thread=thread,
                ),
                timeout=IMPORT_TIMEOUT_SECONDS,
            )
        raise
    print(f"REFRESHED {thread_id} -> {title}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--thread-id")
    args = parser.parse_args()

    hook_module = load_hook_module()
    checked = 0
    refreshed = 0
    errors = 0

    for rollout_path in iter_codex_rollouts():
        try:
            parsed = parse_codex_session_streaming(rollout_path, truncate_large_content=True)
            thread_id = parsed["thread_id"]
        except Exception as exc:
            errors += 1
            print(f"ERROR parse {rollout_path}: {exc}", flush=True)
            continue

        if args.thread_id and thread_id != args.thread_id:
            continue

        try:
            thread_payload = get_thread(thread_id)
        except SystemExit as exc:
            errors += 1
            print(f"ERROR fetch {thread_id}: exited {exc.code}", flush=True)
            continue

        if not thread_payload:
            continue

        checked += 1
        if checked % 25 == 0:
            print(f"PROGRESS checked={checked} refreshed={refreshed} errors={errors}", flush=True)

        thread = thread_payload.get("thread", {})
        current_title = (thread.get("title") or "").strip()
        desired_title = hook_module.derive_thread_title(
            parsed,
            parsed.get("workspace") or parsed.get("metadata", {}).get("cwd") or "",
        )

        should_refresh = args.all or current_title.startswith(AGENTS_PREFIX)
        if not should_refresh or current_title == desired_title:
            continue

        try:
            refresh_thread(
                thread_id,
                desired_title,
                parsed.get("messages", []),
                args.dry_run,
                original_title=current_title,
                original_messages=thread_payload.get("messages", []),
                thread=thread,
            )
            refreshed += 1
        except SystemExit as exc:
            errors += 1
            print(f"ERROR refresh {thread_id}: exited {exc.code}", flush=True)

    print(
        json.dumps(
            {
                "checked": checked,
                "refreshed": refreshed,
                "errors": errors,
                "dry_run": args.dry_run,
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
