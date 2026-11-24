#!/usr/bin/env python3
"""Measure actual registered commands in disposable homes without mailbox access."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import statistics
import subprocess
import tarfile
import tempfile
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-ref", required=True)
    parser.add_argument("--samples", type=int, default=100)
    args = parser.parse_args()
    if not 10 <= args.samples <= 500:
        parser.error("samples must be between 10 and 500")
    repository = Path(__file__).resolve().parents[2]
    package = "nowledge-mem-codex-plugin"
    baseline = subprocess.check_output(
        ["git", "rev-parse", args.baseline_ref], cwd=repository, text=True
    ).strip()
    archive = subprocess.check_output(
        ["git", "archive", baseline, package], cwd=repository
    )
    event = json.dumps(
        {
            "hook_event_name": "Stop",
            "session_id": "benchmark-session",
            "stop_hook_active": False,
        }
    )
    timings = {
        key: []
        for key in (
            "baseline_unconfigured",
            "candidate_unconfigured",
            "candidate_cached_pending",
        )
    }
    with tempfile.TemporaryDirectory(prefix="bridge-notice-benchmark-") as temporary:
        root = Path(temporary)
        with tarfile.open(fileobj=io.BytesIO(archive)) as source:
            for member in source.getmembers():
                if (
                    Path(member.name).is_absolute()
                    or ".." in Path(member.name).parts
                    or member.issym()
                    or member.islnk()
                ):
                    raise ValueError("unsafe baseline package")
            source.extractall(root / "baseline")
        configured = root / "configured"
        cache = configured / "bridge-notices-v1"
        cache.mkdir(parents=True, mode=0o700)
        counter = root / "unexpected-cli"
        sentinel = root / ("nmem.cmd" if os.name == "nt" else "nmem")
        sentinel.write_text(
            '@echo started>>"%NMEM_BENCHMARK_COUNTER%"\n@exit /b 70\n'
            if os.name == "nt"
            else '#!/bin/sh\nprintf started >> "$NMEM_BENCHMARK_COUNTER"\nexit 70\n'
        )
        sentinel.chmod(0o700)
        env = {
            key: value
            for key, value in os.environ.items()
            if not key.startswith(("NMEM_", "GROK_"))
        }
        env.update(NMEM_CLI_PATH=str(sentinel), NMEM_BENCHMARK_COUNTER=str(counter))
        key = "1" * 64
        subscription = {
            "host": "codex",
            "session_id": "benchmark-session",
            "native": False,
            "record": {"name": "approved", "revision": "a" * 64},
        }

        def write(name, value):
            path = cache / name
            path.write_text(json.dumps(value))
            path.chmod(0o600)

        write("enabled", {"schema_version": 1})
        write("subscriptions.json", {key: subscription})
        commands = {}
        for label, plugin in [
            ("baseline_unconfigured", root / "baseline" / package),
            ("candidate_unconfigured", repository / package),
            ("candidate_cached_pending", repository / package),
        ]:
            hooks = json.loads((plugin / "hooks/hooks.json").read_text())["hooks"][
                "Stop"
            ]
            entry = next(
                hook
                for group in hooks
                for hook in group["hooks"]
                if "nmem-mailbox-stop.py" in hook.get("command", "")
            )
            command = (
                entry["commandWindows"]
                if os.name == "nt"
                else ["/bin/sh", "-c", entry["command"]]
            )
            commands[label] = (command, plugin)
        for sample in range(args.samples):
            now = int(time.time() * 1000)
            write(
                key + ".json",
                {
                    "schema_version": 1,
                    "state": "fresh",
                    "has_pending": True,
                    "host": "codex",
                    "session_id": "benchmark-session",
                    "context": "approved",
                    "context_revision": "a" * 64,
                    "binding_key": "b" * 64,
                    "observer_binding_key": "b" * 64,
                    "identity_key": "e" * 64,
                    "change_token": f"{sample+1:064x}",
                    "config_fence": hashlib.sha256(b"").hexdigest(),
                    "mailbox_kind": "identity",
                    "saved_ms": now,
                    "expires_ms": now + 45_000,
                },
            )
            for label, (command, plugin) in commands.items():
                child_env = dict(
                    env,
                    PLUGIN_ROOT=str(plugin),
                    CLAUDE_PLUGIN_ROOT=str(plugin),
                    NMEM_CLI_CONFIG_DIR=str(
                        configured
                        if label.endswith("pending")
                        else root / "unconfigured"
                    ),
                )
                started = time.perf_counter()
                result = subprocess.run(
                    command,
                    shell=os.name == "nt",
                    cwd=root,
                    env=child_env,
                    input=event,
                    text=True,
                    capture_output=True,
                    timeout=2,
                )
                timings[label].append((time.perf_counter() - started) * 1000)
                if result.returncode:
                    raise RuntimeError(f"{label} failed: {result.stderr}")
                response = json.loads(result.stdout or "{}")
                if (response.get("decision") == "block") != label.endswith("pending"):
                    raise RuntimeError(f"{label} did not exercise its actual hook path")
                if counter.exists():
                    raise RuntimeError("an arrival hook invoked the CLI")

    def receipt(values):
        ordered = sorted(values)
        return {
            "samples": len(values),
            "median_ms": round(statistics.median(values), 3),
            "p95_ms": round(ordered[min(len(values) - 1, int(len(values) * 0.95))], 3),
            "max_ms": round(max(values), 3),
        }

    print(
        json.dumps(
            {
                "baseline_ref": baseline,
                "candidate_files_sha256": {
                    str(path.relative_to(repository)): hashlib.sha256(
                        path.read_bytes()
                    ).hexdigest()
                    for path in [
                        repository / package / "hooks/hooks.json",
                        repository / package / "hooks/nmem_bridge_notice.py",
                        repository / package / "hooks/nmem-mailbox-stop.py",
                    ]
                },
                "results": {
                    label: receipt(values) for label, values in timings.items()
                },
                "cli_invocations": 0,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
