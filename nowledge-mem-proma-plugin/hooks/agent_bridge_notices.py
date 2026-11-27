"""Read bounded local notice hints and release actual host subscriptions."""

import json
import ntpath
import os
import re
import shutil
import subprocess


def valid_bridge_session(session):
    try:
        return (isinstance(session, str) and bool(session.strip()) and session != "unknown"
                and len(session.encode("utf-8")) <= 1024
                and not any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in session))
    except UnicodeError:
        return False


def bridge_session_hint(host, session):
    if not host or not valid_bridge_session(session):
        return ""
    return (
        "Host session correlation (not identity or delivery readiness): "
        + json.dumps({"host": host, "session_id": session})
        + ". Only when the user separately requests ongoing Agent-mailbox notifications across authorized Spaces, verify the existing approved Agent Context and subscribe this actual session "
        "using nmem --json --agent-context=<approved-context> bridge notices subscribe "
        "--host=" + host + " and the literal --session-id value above. This opts this session into "
        "shared Agent-mailbox hints, not native sessions or precise reply routing. The startup one-page "
        "inbox opt-in alone does not authorize this subscription. If the installed "
        "CLI rejects the command, keep the original identity and use the existing inbox check. "
        "Never invent a replacement session."
    )


def bridge_notice_hint(host, session, env=None):
    if not host or not valid_bridge_session(session):
        return ""
    try:
        from .nmem_bridge_notice import response
    except ImportError:
        from nmem_bridge_notice import response
    try:
        value = response({"hook_event_name": "UserPromptSubmit", "session_id": session}, host=host, environ=env)
    except (OSError, RuntimeError):
        return ""
    return value.get("hookSpecificOutput", {}).get("additionalContext", "")


def close_bridge_session(host, session, runner=None):
    if not host or not valid_bridge_session(session):
        return
    args = ["--json", "bridge", "notices", "unsubscribe", "--host=" + host,
            "--session-id=" + session, "--ended"]
    try:
        if runner is not None:
            runner(args, timeout=0.5)
        else:
            env = os.environ.copy()
            for key in ("NMEM_AGENT_CONTEXT", "NMEM_AGENT_ID", "NMEM_SPACE", "NMEM_SPACE_ID", "NMEM_HOST_AGENT_ID"):
                env.pop(key, None)
            subprocess.run(_cleanup_command(args, env), env=env,
                           stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           timeout=0.5, check=False,
                           **({"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}))
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass


def _cleanup_command(args, env):
    executable = env.get("NMEM_CLI_PATH") or shutil.which("nmem", path=env.get("PATH")) or "nmem"
    if os.name != "nt" or not executable.lower().endswith((".cmd", ".bat")):
        return [executable] + args
    # Match the Pi/JavaScript launcher: preserve opaque argv, forbid cmd expansion.
    if any(re.search(r"%[A-Za-z_][A-Za-z0-9_]*%", arg) for arg in args):
        raise ValueError("Windows batch arguments cannot contain environment expansion")
    root = env.get("SystemRoot", r"C:\Windows")
    if not ntpath.isabs(root):
        root = r"C:\Windows"
    command = ntpath.join(root, "System32", "cmd.exe")
    return '"' + command + '" /d /s /c "' + " ".join(_quote_batch_arg(arg) for arg in [executable] + args) + '"'


def _quote_batch_arg(arg):
    quoted = ['"']
    index = 0
    while index < len(arg):
        slashes = 0
        while index < len(arg) and arg[index] == "\\":
            slashes += 1
            index += 1
        if index == len(arg):
            quoted.append("\\" * (slashes * 2))
            break
        if arg[index] == '"':
            quoted.extend(["\\" * (slashes * 2), '""'])
        else:
            quoted.extend(["\\" * slashes, arg[index]])
        index += 1
    return "".join(quoted) + '"'
