#!/usr/bin/env python3
"""Install Nowledge Mem Codex lifecycle hooks into the current CODEX_HOME."""

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
PLUGIN_HOOKS_DIR = PLUGIN_ROOT / "hooks"
if str(PLUGIN_HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(PLUGIN_HOOKS_DIR))

from nmem_runtime import build_nmem_command as _build_nmem_command
from nmem_runtime import find_nmem_command as _find_nmem_command
from nmem_runtime import windows_no_window_kwargs as _windows_no_window_kwargs


CODEX_DIR = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")).expanduser()
HOOKS_DIR = CODEX_DIR / "hooks"
GLOBAL_HOOKS_FILE = CODEX_DIR / "hooks.json"
CONFIG_FILE = CODEX_DIR / "config.toml"
SOURCE_HOOK = PLUGIN_ROOT / "hooks" / "nmem-stop-save.py"
INSTALLED_HOOK = HOOKS_DIR / "nowledge-mem-stop-save.py"
SOURCE_SKILL_OUTCOME = PLUGIN_ROOT / "hooks" / "skill_outcome.py"
INSTALLED_SKILL_OUTCOME = HOOKS_DIR / "skill_outcome.py"
SOURCE_NMEM_RUNTIME = PLUGIN_ROOT / "hooks" / "nmem_runtime.py"
INSTALLED_NMEM_RUNTIME = HOOKS_DIR / "nmem_runtime.py"
SOURCE_STOP_MAINTENANCE = PLUGIN_ROOT / "hooks" / "nmem_stop_maintenance.py"
INSTALLED_STOP_MAINTENANCE = HOOKS_DIR / "nmem_stop_maintenance.py"
SOURCE_PENDING = PLUGIN_ROOT / "hooks" / "nmem_pending.py"
INSTALLED_PENDING = HOOKS_DIR / "nmem_pending.py"
CODEX_HOOKS_KEY_RE = re.compile(r"^\s*(?:codex_hooks|\"codex_hooks\"|'codex_hooks')\s*=")
CODEX_HOOKS_NEW_KEY_RE = re.compile(r"^\s*(?:hooks|\"hooks\"|'hooks')\s*=")
CODEX_PLUGIN_HOOKS_KEY_RE = re.compile(r"^\s*(?:plugin_hooks|\"plugin_hooks\"|'plugin_hooks')\s*=")
TOML_ENABLED_KEY_RE = re.compile(r"^\s*(?:enabled|\"enabled\"|'enabled')\s*=")
NOWLEDGE_HOOK_MARKERS = ("nowledge-mem-stop-save.py", "nmem-stop-save.py")
PLUGIN_HOOK_STATE_KEYS = (
    "nowledge-mem@nowledge-community:hooks/hooks.json:session_start:0:0",
    "nowledge-mem@nowledge-community:hooks/hooks.json:subagent_start:0:0",
    "nowledge-mem@nowledge-community:hooks/hooks.json:user_prompt_submit:0:0",
    "nowledge-mem@nowledge-community:hooks/hooks.json:stop:0:0",
    "nowledge-mem@local:hooks/hooks.json:session_start:0:0",
    "nowledge-mem@local:hooks/hooks.json:subagent_start:0:0",
    "nowledge-mem@local:hooks/hooks.json:user_prompt_submit:0:0",
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
    if not SOURCE_SKILL_OUTCOME.exists():
        raise SystemExit(f"missing skill outcome extractor: {SOURCE_SKILL_OUTCOME}")
    shutil.copy2(SOURCE_SKILL_OUTCOME, INSTALLED_SKILL_OUTCOME)
    if not SOURCE_NMEM_RUNTIME.exists():
        raise SystemExit(f"missing nmem runtime helper: {SOURCE_NMEM_RUNTIME}")
    shutil.copy2(SOURCE_NMEM_RUNTIME, INSTALLED_NMEM_RUNTIME)
    if not SOURCE_STOP_MAINTENANCE.exists():
        raise SystemExit(f"missing Stop maintenance adapter: {SOURCE_STOP_MAINTENANCE}")
    shutil.copy2(SOURCE_STOP_MAINTENANCE, INSTALLED_STOP_MAINTENANCE)
    if not SOURCE_PENDING.exists():
        raise SystemExit(f"missing pending maintenance helper: {SOURCE_PENDING}")
    shutil.copy2(SOURCE_PENDING, INSTALLED_PENDING)


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
                    "timeout": 15,
                    "statusMessage": "Queueing Codex thread capture...",
                }
            ],
        }
    )
    hooks_doc["hooks"]["Stop"] = cleaned
    save_json(GLOBAL_HOOKS_FILE, hooks_doc)


def _parse_codex_toml(text: str) -> dict:
    """Use an actual TOML parser, including when setup runs on older Python."""
    try:
        import tomllib
    except ModuleNotFoundError:
        pass
    else:
        return tomllib.loads(text)

    # Isolated interpreter mode ignores user-site/PYTHONPATH injection. Config
    # travels on stdin; only the two advisory sections return, never API keys.
    reader = (
        "import sys,json\n"
        "try: import tomllib\n"
        "except ImportError: sys.exit(3)\n"
        "try: config=tomllib.loads(sys.stdin.read())\n"
        "except tomllib.TOMLDecodeError: sys.exit(2)\n"
        "json.dump({k:config.get(k) for k in ('features','memories')},sys.stdout,default=str)\n"
    )
    commands = []
    for name in ("python3.14", "python3.13", "python3.12", "python3.11", "python3", "python"):
        executable = shutil.which(name)
        if executable and [executable] not in commands:
            commands.append([executable])
    launcher = shutil.which("py") if os.name == "nt" else None
    if launcher:
        commands.extend([launcher, version] for version in ("-3.14", "-3.13", "-3.12", "-3.11"))
    for command in commands:
        try:
            result = subprocess.run(
                [*command, "-I", "-c", reader], input=text, capture_output=True,
                text=True, encoding="utf-8", timeout=5, check=False,
                **_windows_no_window_kwargs(),
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        if result.returncode == 2:
            raise ValueError("Invalid TOML")
        if result.returncode == 0:
            try:
                parsed = json.loads(result.stdout)
            except (ValueError, TypeError):
                continue
            if isinstance(parsed, dict) and set(parsed) == {"features", "memories"}:
                return parsed
    raise SystemExit(
        "error: setup requires a Python 3.11 or newer TOML parser. "
        "Run setup with Python 3.11 or newer, or make that interpreter available on PATH."
    )


def _validate_toml_if_possible(text: str) -> None:
    try:
        _parse_codex_toml(text)
    except Exception as error:
        raise SystemExit(
            f"error: refusing to modify invalid Codex config.toml: {error}"
        ) from error


def _toml_structural_lines(lines: list[str]) -> set[int]:
    """Exclude multiline string contents from table/key/comment editing."""
    structural = set()
    multiline = None
    for index, line in enumerate(lines):
        if multiline is None:
            structural.add(index)
        position = 0
        quote = None
        while position < len(line):
            if multiline is not None:
                if multiline == '"' * 3 and line[position] == "\\":
                    position += 2
                elif line.startswith(multiline, position):
                    position += 3
                    multiline = None
                else:
                    position += 1
            elif quote is not None:
                if quote == '"' and line[position] == "\\":
                    position += 2
                elif line[position] == quote:
                    position += 1
                    quote = None
                else:
                    position += 1
            elif line[position] == "#":
                break
            elif line[position] in ("'", '"'):
                quote = line[position]
                if line.startswith(quote * 3, position):
                    multiline = quote * 3
                    quote = None
                    position += 3
                else:
                    position += 1
            else:
                position += 1
    return structural


def _table_header_key(line: str) -> tuple[str, ...] | None:
    """Recognize equivalent table spellings without rewriting user comments."""
    stripped = line.strip()
    if not TOML_SECTION_HEADER_RE.fullmatch(stripped) or stripped.startswith("[["):
        return None
    # The header regexp validates the whole line, including any trailing comment.
    header = re.match(rf"^\[\s*({TOML_KEY_SEGMENT}(?:\s*\.\s*{TOML_KEY_SEGMENT})*)\s*\]", stripped)
    assert header is not None
    tokens = re.findall(TOML_KEY_SEGMENT, header.group(1))
    result = []
    for token in tokens:
        if token.startswith('"'):
            try:
                result.append(json.loads(token))
            except ValueError:
                return None
        elif token.startswith("'"):
            result.append(token[1:-1])
        else:
            result.append(token)
    return tuple(result)


def _section_bounds(lines: list[str], section_header: str) -> tuple[int | None, int]:
    section_start = None
    section_end = len(lines)

    structural = _toml_structural_lines(lines)
    for index, line in enumerate(lines):
        if index in structural and _table_header_key(line) == _table_header_key(section_header):
            section_start = index
            break

    if section_start is None:
        return None, section_end

    for index in range(section_start + 1, len(lines)):
        stripped = lines[index].strip()
        if index in structural and TOML_SECTION_HEADER_RE.match(stripped):
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


def codex_requires_legacy_plugin_hooks_gate() -> bool:
    """Ask Codex whether plugin_hooks is still an active feature gate."""
    codex = shutil.which("codex")
    if not codex:
        return True
    try:
        proc = subprocess.run(
            [codex, "features", "list"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=8,
        )
    except (OSError, subprocess.TimeoutExpired):
        return True
    if proc.returncode != 0:
        return True
    for line in proc.stdout.splitlines():
        fields = line.split()
        if fields and fields[0] == "plugin_hooks":
            return len(fields) < 2 or fields[1].lower() != "removed"
    return True


def ensure_codex_hooks_enabled(*, plugin_hooks_required: bool = True) -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    text = CONFIG_FILE.read_text(encoding="utf-8") if CONFIG_FILE.exists() else ""
    _validate_toml_if_possible(text)

    lines = text.splitlines()
    section_header = "[features]"
    features_start, features_end = _section_bounds(lines, section_header)

    if features_start is None:
        if lines and lines[-1] != "":
            lines.append("")
        lines.extend([section_header, "hooks = true"])
        if plugin_hooks_required:
            lines.append("plugin_hooks = true")
    else:
        has_hooks_key = False
        has_plugin_hooks_key = False
        codex_hooks_index = None
        structural = _toml_structural_lines(lines)
        for index in range(features_start + 1, features_end):
            if index not in structural:
                continue
            stripped = lines[index].strip()
            if CODEX_HOOKS_NEW_KEY_RE.match(stripped):
                lines[index] = "hooks = true"
                has_hooks_key = True
            elif CODEX_PLUGIN_HOOKS_KEY_RE.match(stripped):
                if plugin_hooks_required:
                    lines[index] = "plugin_hooks = true"
                has_plugin_hooks_key = True
            elif CODEX_HOOKS_KEY_RE.match(stripped):
                codex_hooks_index = index

        if codex_hooks_index is not None:
            lines[codex_hooks_index] = "codex_hooks = true"
        missing_feature_lines = []
        if not has_hooks_key:
            missing_feature_lines.append("hooks = true")
        if plugin_hooks_required and not has_plugin_hooks_key:
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

    _write_codex_config_lines(lines, restrict_permissions=False)


def _hook_state_section_header(key: str) -> str:
    return f"[hooks.state.{json.dumps(key)}]"


def _ensure_enabled_key(lines: list[str], section_header: str) -> list[str]:
    section_start, section_end = _section_bounds(lines, section_header)

    if section_start is None:
        if lines and lines[-1] != "":
            lines.append("")
        lines.extend([section_header, "enabled = true"])
        return lines

    structural = _toml_structural_lines(lines)
    for index in range(section_start + 1, section_end):
        if index in structural and TOML_ENABLED_KEY_RE.match(lines[index].strip()):
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
    nmem = _find_nmem_command()
    if not nmem:
        print(
            "warning: nmem not found; skipped Codex MCP config check",
            file=sys.stderr,
        )
        return None

    try:
        proc = subprocess.run(
            _build_nmem_command(
                nmem, "--json", "config", "mcp", "show", "--host", "codex"
            ),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=8,
            **_windows_no_window_kwargs(),
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
    structural = _toml_structural_lines(lines)
    for index, line in enumerate(lines):
        if index not in structural:
            continue
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

    structural = _toml_structural_lines(lines)
    while index < len(lines):
        line = lines[index]
        if index in structural and line.strip() == MCP_MANAGED_BEGIN:
            end_index = None
            for candidate in range(index + 1, len(lines)):
                if candidate in structural and lines[candidate].strip() == MCP_MANAGED_END:
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

    if _has_existing_unmanaged_nowledge_mcp(lines):
        print(
            "Codex MCP config: existing mcp_servers.nowledge-mem block left unchanged. "
            "Replace it with 'nmem config mcp show --host codex' to carry per-agent "
            "NMEM_AGENT_ID/NMEM_HOST_AGENT_ID values into MCP requests.",
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


def print_codex_memory_coexistence_guidance() -> None:
    """Explain the safe coexistence setting without taking ownership of it."""
    if not CONFIG_FILE.exists():
        return
    try:
        config = _parse_codex_toml(CONFIG_FILE.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError):
        return

    features = config.get("features")
    if not isinstance(features, dict) or not (
        features.get("memories") is True or features.get("memory_tool") is True
    ):
        return
    memories = config.get("memories")
    if isinstance(memories, dict) and memories.get("generate_memories") is False:
        return
    isolated = isinstance(memories, dict) and (
        memories.get("disable_on_external_context") is True
        or memories.get("no_memories_if_mcp_or_web_search") is True
    )
    if isolated:
        return
    print(
        "Codex local Memory is enabled. To keep Nowledge MCP/web results out of "
        "Codex's separate local memory store, turn off 'Allow memory generation "
        "from tool-assisted tasks' in Settings > Personalization, or set "
        "[memories] disable_on_external_context = true. This setup does not "
        "change that user-owned setting.",
        file=sys.stderr,
    )


def main() -> int:
    # Refuse invalid input or an unavailable parser before copying any runtime
    # hook, creating hook state, or editing the user's configuration.
    _validate_toml_if_possible(CONFIG_FILE.read_text(encoding="utf-8") if CONFIG_FILE.exists() else "")
    install_runtime_hook()
    merge_hooks_json()
    plugin_hooks_required = codex_requires_legacy_plugin_hooks_gate()
    ensure_codex_hooks_enabled(plugin_hooks_required=plugin_hooks_required)
    ensure_nowledge_plugin_hook_state_enabled()
    mcp_config_installed = install_codex_mcp_config()
    print_codex_memory_coexistence_guidance()

    print("Installed Nowledge Mem Codex lifecycle hooks")
    print(f"- runtime hook: {INSTALLED_HOOK}")
    print(f"- skill outcome extractor: {INSTALLED_SKILL_OUTCOME}")
    print(f"- cross-platform runtime helper: {INSTALLED_NMEM_RUNTIME}")
    print(f"- hooks config: {GLOBAL_HOOKS_FILE}")
    if plugin_hooks_required:
        print(f"- hook and legacy plugin-hook feature flags ensured in: {CONFIG_FILE}")
    else:
        print(f"- hook feature flag ensured in: {CONFIG_FILE}")
    print(f"- plugin startup, subagent, routing, and Stop hooks enabled in: {CONFIG_FILE}")
    if mcp_config_installed:
        print(f"- authenticated MCP config ensured in: {CONFIG_FILE}")
    print("- restart Codex and trust the new or changed Nowledge Mem hooks when prompted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
