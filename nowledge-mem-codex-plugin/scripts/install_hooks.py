#!/usr/bin/env python3
"""Install the Nowledge Mem Codex Stop hook into the current CODEX_HOME."""

from __future__ import annotations

import json
import os
import re
import shutil
import stat
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
CODEX_DIR = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")).expanduser()
HOOKS_DIR = CODEX_DIR / "hooks"
GLOBAL_HOOKS_FILE = CODEX_DIR / "hooks.json"
CONFIG_FILE = CODEX_DIR / "config.toml"
SOURCE_HOOK = PLUGIN_ROOT / "hooks" / "nmem-stop-save.py"
INSTALLED_HOOK = HOOKS_DIR / "nowledge-mem-stop-save.py"
CODEX_HOOKS_KEY_RE = re.compile(r"^\s*codex_hooks\s*=")
CODEX_HOOKS_NEW_KEY_RE = re.compile(r"^\s*hooks\s*=")
CODEX_PLUGIN_HOOKS_KEY_RE = re.compile(r"^\s*plugin_hooks\s*=")
TOML_ENABLED_KEY_RE = re.compile(r"^\s*enabled\s*=")
NOWLEDGE_HOOK_MARKERS = ("nowledge-mem-stop-save.py", "nmem-stop-save.py")
PLUGIN_HOOK_STATE_KEYS = (
    "nowledge-mem@nowledge-community:hooks/hooks.json:stop:0:0",
    "nowledge-mem@local:hooks/hooks.json:stop:0:0",
)
MCP_MANAGED_BEGIN = "# BEGIN Nowledge Mem MCP (managed by nowledge-mem-codex-plugin)"
MCP_MANAGED_END = "# END Nowledge Mem MCP"
TOML_KEY_SEGMENT = r"(?:[A-Za-z0-9_-]+|\"(?:\\.|[^\"])*\"|'[^']*')"
TOML_MCP_SERVERS_KEY = r"(?:mcp_servers|\"mcp_servers\"|'mcp_servers')"
TOML_NOWLEDGE_MEM_KEY = r"(?:nowledge-mem|\"nowledge-mem\"|'nowledge-mem')"
TOML_SECTION_HEADER_RE = re.compile(
    rf"^(?:\[\s*{TOML_KEY_SEGMENT}(?:\s*\.\s*{TOML_KEY_SEGMENT})*\s*\]"
    rf"|\[\[\s*{TOML_KEY_SEGMENT}(?:\s*\.\s*{TOML_KEY_SEGMENT})*\s*\]\])"
    r"\s*(?:#.*)?$"
)
NOWLEDGE_MCP_SECTION_RE = re.compile(
    rf"^\s*\[\s*{TOML_MCP_SERVERS_KEY}\s*\.\s*{TOML_NOWLEDGE_MEM_KEY}"
    rf"(?:\s*\.\s*{TOML_KEY_SEGMENT})*\s*\]\s*(?:#.*)?$"
)


def _backup_path(path: Path) -> Path:
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return path.with_name(f"{path.name}.{suffix}.bak")


def backup_invalid_json(path: Path, *, reason: str) -> dict:
    backup = _backup_path(path)
    shutil.move(path, backup)
    print(f"warning: moved {reason} to {backup}", file=sys.stderr)
    return {}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return backup_invalid_json(path, reason="malformed hooks JSON")
    if not isinstance(payload, dict):
        return backup_invalid_json(path, reason="non-object hooks JSON")
    return payload


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def normalize_hooks_doc(hooks_doc: dict) -> tuple[dict, list[dict]]:
    hooks = hooks_doc.get("hooks")
    if not isinstance(hooks, dict):
        hooks = {}
        hooks_doc["hooks"] = hooks

    stop_hooks = hooks.get("Stop")
    if not isinstance(stop_hooks, list):
        stop_hooks = []

    normalized_stop_hooks: list[dict] = []
    for entry in stop_hooks:
        if not isinstance(entry, dict):
            continue
        normalized_entry = dict(entry)
        if not isinstance(normalized_entry.get("hooks"), list):
            normalized_entry["hooks"] = []
        normalized_stop_hooks.append(normalized_entry)

    hooks["Stop"] = normalized_stop_hooks
    return hooks_doc, normalized_stop_hooks


def install_runtime_hook() -> None:
    if not SOURCE_HOOK.exists():
        raise SystemExit(f"missing hook runtime: {SOURCE_HOOK}")
    HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE_HOOK, INSTALLED_HOOK)
    mode = INSTALLED_HOOK.stat().st_mode
    INSTALLED_HOOK.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _quote_for_hook_command(path: Path) -> str:
    return json.dumps(str(path))


def _hook_command() -> str:
    return f"{_quote_for_hook_command(Path(sys.executable))} {_quote_for_hook_command(INSTALLED_HOOK)} --event stop"


def _is_nowledge_hook(hook: object) -> bool:
    if not isinstance(hook, dict):
        return False
    command = hook.get("command")
    return isinstance(command, str) and any(marker in command for marker in NOWLEDGE_HOOK_MARKERS)


def merge_hooks_json() -> None:
    hooks_doc = load_json(GLOBAL_HOOKS_FILE)
    if GLOBAL_HOOKS_FILE.exists():
        backup = GLOBAL_HOOKS_FILE.with_suffix(".json.bak")
        if not backup.exists():
            shutil.copy2(GLOBAL_HOOKS_FILE, backup)

    hooks_doc, stop_hooks = normalize_hooks_doc(hooks_doc)
    cleaned: list[dict] = []
    for entry in stop_hooks:
        hooks = [hook for hook in entry["hooks"] if not _is_nowledge_hook(hook)]
        if hooks:
            next_entry = dict(entry)
            next_entry["hooks"] = hooks
            cleaned.append(next_entry)

    cleaned.append(
        {
            "matcher": ".*",
            "hooks": [
                {
                    "type": "command",
                    "command": _hook_command(),
                    "timeout": 40,
                    "statusMessage": "Saving Codex thread to Nowledge Mem...",
                }
            ],
        }
    )
    hooks_doc["hooks"]["Stop"] = cleaned
    save_json(GLOBAL_HOOKS_FILE, hooks_doc)


def _validate_toml_if_possible(text: str) -> None:
    if not text.strip():
        return
    try:
        import tomllib

        tomllib.loads(text)
    except ModuleNotFoundError:
        return
    except Exception as error:
        raise SystemExit(
            f"error: refusing to modify invalid Codex config.toml: {error}"
        ) from error


def _section_bounds(lines: list[str], section_header: str) -> tuple[int | None, int]:
    section_start = None
    section_end = len(lines)

    for index, line in enumerate(lines):
        if line.strip() == section_header:
            section_start = index
            break

    if section_start is None:
        return None, section_end

    for index in range(section_start + 1, len(lines)):
        stripped = lines[index].strip()
        if TOML_SECTION_HEADER_RE.match(stripped):
            section_end = index
            break

    return section_start, section_end


def _before_trailing_blank_lines(
    lines: list[str],
    *,
    section_start: int,
    section_end: int,
) -> int:
    insert_at = section_end
    while insert_at > section_start + 1 and lines[insert_at - 1].strip() == "":
        insert_at -= 1
    return insert_at


def ensure_codex_hooks_enabled() -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    text = CONFIG_FILE.read_text(encoding="utf-8") if CONFIG_FILE.exists() else ""
    _validate_toml_if_possible(text)

    lines = text.splitlines()
    section_header = "[features]"
    features_start, features_end = _section_bounds(lines, section_header)

    if features_start is None:
        if lines and lines[-1] != "":
            lines.append("")
        lines.extend([section_header, "hooks = true", "plugin_hooks = true"])
    else:
        has_hooks_key = False
        has_plugin_hooks_key = False
        codex_hooks_index = None
        for index in range(features_start + 1, features_end):
            stripped = lines[index].strip()
            if CODEX_HOOKS_NEW_KEY_RE.match(stripped):
                lines[index] = "hooks = true"
                has_hooks_key = True
            elif CODEX_PLUGIN_HOOKS_KEY_RE.match(stripped):
                lines[index] = "plugin_hooks = true"
                has_plugin_hooks_key = True
            elif CODEX_HOOKS_KEY_RE.match(stripped):
                codex_hooks_index = index

        if codex_hooks_index is not None:
            lines[codex_hooks_index] = "codex_hooks = true"
        missing_feature_lines = []
        if not has_hooks_key:
            missing_feature_lines.append("hooks = true")
        if not has_plugin_hooks_key:
            missing_feature_lines.append("plugin_hooks = true")
        if missing_feature_lines:
            insert_at = (
                codex_hooks_index + 1
                if codex_hooks_index is not None
                else _before_trailing_blank_lines(
                    lines,
                    section_start=features_start,
                    section_end=features_end,
                )
            )
            for line in reversed(missing_feature_lines):
                lines.insert(insert_at, line)

    updated = "\n".join(lines)
    if updated and not updated.endswith("\n"):
        updated += "\n"
    CONFIG_FILE.write_text(updated, encoding="utf-8")


def _hook_state_section_header(key: str) -> str:
    return f"[hooks.state.{json.dumps(key)}]"


def _ensure_enabled_key(lines: list[str], section_header: str) -> list[str]:
    section_start, section_end = _section_bounds(lines, section_header)

    if section_start is None:
        if lines and lines[-1] != "":
            lines.append("")
        lines.extend([section_header, "enabled = true"])
        return lines

    for index in range(section_start + 1, section_end):
        if TOML_ENABLED_KEY_RE.match(lines[index].strip()):
            lines[index] = "enabled = true"
            return lines

    insert_at = _before_trailing_blank_lines(
        lines,
        section_start=section_start,
        section_end=section_end,
    )
    lines.insert(insert_at, "enabled = true")
    return lines


def ensure_nowledge_plugin_hook_state_enabled() -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    text = CONFIG_FILE.read_text(encoding="utf-8") if CONFIG_FILE.exists() else ""
    _validate_toml_if_possible(text)

    lines = text.splitlines()
    for key in PLUGIN_HOOK_STATE_KEYS:
        lines = _ensure_enabled_key(lines, _hook_state_section_header(key))

    _write_codex_config_lines(lines, restrict_permissions=False)


def _load_codex_mcp_payload() -> dict | None:
    nmem = shutil.which("nmem")
    if not nmem:
        print(
            "warning: nmem not found; skipped Codex MCP config check",
            file=sys.stderr,
        )
        return None

    try:
        proc = subprocess.run(
            [nmem, "--json", "config", "mcp", "show", "--host", "codex"],
            capture_output=True,
            text=True,
            check=False,
            timeout=8,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        print(
            f"warning: could not run 'nmem config mcp show --host codex': {error}",
            file=sys.stderr,
        )
        return None

    if proc.returncode != 0:
        stderr = (proc.stderr or proc.stdout or "").strip()
        print(
            "warning: skipped Codex MCP config; update nmem and run "
            "'nmem config mcp show --host codex' if Codex MCP reports Not logged in"
            + (f" ({stderr})" if stderr else ""),
            file=sys.stderr,
        )
        return None

    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        print(
            "warning: skipped Codex MCP config; nmem did not return JSON",
            file=sys.stderr,
        )
        return None

    return payload if isinstance(payload, dict) else None


def _has_existing_unmanaged_nowledge_mcp(lines: list[str]) -> bool:
    in_managed = False
    for line in lines:
        stripped = line.strip()
        if stripped == MCP_MANAGED_BEGIN:
            in_managed = True
            continue
        if stripped == MCP_MANAGED_END:
            in_managed = False
            continue
        if not in_managed and NOWLEDGE_MCP_SECTION_RE.match(stripped):
            return True
    return False


def _remove_managed_mcp_block(lines: list[str]) -> tuple[list[str], bool, bool]:
    cleaned: list[str] = []
    removed = False
    index = 0

    while index < len(lines):
        line = lines[index]
        if line.strip() == MCP_MANAGED_BEGIN:
            end_index = None
            for candidate in range(index + 1, len(lines)):
                if lines[candidate].strip() == MCP_MANAGED_END:
                    end_index = candidate
                    break
            if end_index is None:
                return lines, removed, True
            removed = True
            index = end_index + 1
            continue
        cleaned.append(line)
        index += 1

    return cleaned, removed, False


def _should_install_mcp_override(payload: dict) -> bool:
    if payload.get("apiKeyConfigured"):
        return True
    endpoint = str(payload.get("endpoint") or "")
    if endpoint and endpoint != "http://127.0.0.1:14242/mcp/":
        return True
    return False


def _write_codex_config_lines(
    lines: list[str],
    *,
    restrict_permissions: bool,
) -> None:
    updated = "\n".join(lines)
    if updated and not updated.endswith("\n"):
        updated += "\n"
    _validate_toml_if_possible(updated)
    if restrict_permissions:
        try:
            if CONFIG_FILE.exists():
                CONFIG_FILE.chmod(stat.S_IRUSR | stat.S_IWUSR)
            else:
                fd = os.open(
                    CONFIG_FILE,
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                    stat.S_IRUSR | stat.S_IWUSR,
                )
                os.close(fd)
        except OSError as error:
            raise SystemExit(
                f"error: refusing to write Codex MCP API key before securing {CONFIG_FILE}: {error}"
            ) from error

    CONFIG_FILE.write_text(updated, encoding="utf-8")
    if restrict_permissions:
        try:
            CONFIG_FILE.chmod(stat.S_IRUSR | stat.S_IWUSR)
        except OSError as error:
            print(
                f"warning: could not restrict permissions on {CONFIG_FILE}: {error}",
                file=sys.stderr,
            )


def _install_mcp_config_from_payload(payload: dict) -> bool:
    rendered = str(payload.get("rendered") or "").strip()
    if not rendered:
        return False

    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    text = CONFIG_FILE.read_text(encoding="utf-8") if CONFIG_FILE.exists() else ""
    _validate_toml_if_possible(text)
    lines = text.splitlines()
    (
        lines,
        removed_managed_block,
        unterminated_managed_block,
    ) = _remove_managed_mcp_block(lines)
    if unterminated_managed_block:
        print(
            "Codex MCP config: found an unterminated managed Nowledge Mem MCP block; "
            "left config.toml unchanged. Remove or repair the managed BEGIN/END "
            "markers, then rerun this setup.",
            file=sys.stderr,
        )
        return False

    if not _should_install_mcp_override(payload):
        print(
            "Codex MCP config: using the plugin-bundled local endpoint. "
            "If 'codex mcp list' shows Not logged in, ensure nmem is up to date, "
            "install or update the CLI from the Nowledge Mem desktop app, refresh "
            "desktop credentials if needed, then rerun this setup.",
            file=sys.stderr,
        )
        if removed_managed_block:
            _write_codex_config_lines(lines, restrict_permissions=False)
            return True
        return False

    if _has_existing_unmanaged_nowledge_mcp(lines):
        print(
            "Codex MCP config: existing mcp_servers.nowledge-mem block left unchanged. "
            "Replace it with 'nmem config mcp show --host codex' if Codex MCP reports Not logged in.",
            file=sys.stderr,
        )
        return False

    block = [MCP_MANAGED_BEGIN, *rendered.splitlines(), MCP_MANAGED_END]
    while lines and lines[-1] == "":
        lines.pop()
    if lines:
        lines.append("")
    lines.extend(block)

    _write_codex_config_lines(
        lines,
        restrict_permissions=bool(payload.get("apiKeyConfigured")),
    )
    return True


def install_codex_mcp_config() -> bool:
    payload = _load_codex_mcp_payload()
    if payload is None:
        return False

    installed = _install_mcp_config_from_payload(payload)
    for warning in payload.get("warnings") or []:
        print(f"warning: nmem MCP config: {warning}", file=sys.stderr)
    return installed


def main() -> int:
    install_runtime_hook()
    merge_hooks_json()
    ensure_codex_hooks_enabled()
    ensure_nowledge_plugin_hook_state_enabled()
    mcp_config_installed = install_codex_mcp_config()

    print("Installed Nowledge Mem Codex Stop hook")
    print(f"- runtime hook: {INSTALLED_HOOK}")
    print(f"- hooks config: {GLOBAL_HOOKS_FILE}")
    print(f"- hook feature flags ensured in: {CONFIG_FILE}")
    print(f"- plugin Stop hook enabled in: {CONFIG_FILE}")
    if mcp_config_installed:
        print(f"- authenticated MCP config ensured in: {CONFIG_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
