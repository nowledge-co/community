#!/usr/bin/env python3
"""Keep the Bridge reminder embedded in standalone hook packages."""

import argparse
import json
import runpy
import shlex
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = {
    "agent-bridge-startup.mjs": (
        "nowledge-mem-deepseek-harness-plugin/src",
        "nowledge-mem-opencode-plugin/src",
        "nowledge-mem-amp-plugin/src",
        "nowledge-mem-alma-plugin",
        "nowledge-mem-openclaw-plugin/src/hooks",
        "nowledge-mem-pi-package/extensions",
        "nowledge-mem-workbuddy-plugin/scripts",
    ),
    "agent_bridge_startup.py": (
        "nowledge-mem-copilot-cli-plugin/hooks",
        "nowledge-mem-dim-plugin/scripts",
        "nowledge-mem-openhands-plugin/hooks",
        "nowledge-mem-bub-plugin/src/nowledge_mem_bub",
        "nowledge-mem-hermes",
        "nowledge-mem-icode-plugin/hooks",
        "nowledge-mem-kimi-code-plugin/scripts",
        "nowledge-mem-kimi-work-connector/scripts",
    ),
    "kimi-bridge-startup.py": (
        "nowledge-mem-kimi-code-plugin/scripts",
        "nowledge-mem-kimi-work-connector/scripts",
    ),
}

SHELL_HOSTS = (
    "nowledge-mem-codebuddy-plugin/hooks/hooks.json",
    "nowledge-mem-droid-plugin/hooks/hooks.json",
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    valid = True
    for name, directories in TARGETS.items():
        content = Path(__file__).with_name(name).read_bytes()
        for directory in directories:
            target = ROOT / directory / name
            if args.write:
                target.write_bytes(content)
            if not target.is_file() or target.read_bytes() != content:
                print(f"Stale Bridge startup helper: {target.relative_to(ROOT)}")
                valid = False
    guidance = runpy.run_path(str(Path(__file__).with_name("agent_bridge_startup.py")))["_GUIDANCE"]
    command = (
        '[ "${NMEM_BRIDGE_INBOX_ON_START:-}" = 1 ] || exit 0; '
        'case "${NMEM_AGENT_CONTEXT:-}" in *[![:space:]]*) '
        f"printf '%s\\n' {shlex.quote(guidance)} ;; esac"
    )
    hook_group = {
        "matcher": "startup|resume",
        "hooks": [{"type": "command", "command": command, "timeout": 5}],
    }
    for filename in SHELL_HOSTS:
        path = ROOT / filename
        data = json.loads(path.read_text(encoding="utf-8"))
        groups = data["hooks"]["SessionStart"]
        packaged = [group for group in groups if any(
            'NMEM_BRIDGE_INBOX_ON_START' in hook.get("command", "") for hook in group["hooks"]
        )]
        if packaged != [hook_group]:
            if args.write:
                groups[:] = [group for group in groups if group not in packaged]
                groups.append(hook_group)
                path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            else:
                print(f"Stale Bridge startup command: {filename}")
                valid = False
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
