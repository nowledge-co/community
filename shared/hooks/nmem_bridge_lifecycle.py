"""Release only an ended session's local subscription; no mailbox operation."""

from __future__ import annotations

import os
import shutil
import subprocess


def close_session(event: dict, host: str) -> None:
    session = event.get("session_id")
    if (
        event.get("hook_event_name") != "SessionEnd"
        or not isinstance(session, str)
        or not session
        or len(session) > 1024
    ):
        return
    executable = os.environ.get("NMEM_CLI_PATH") or shutil.which("nmem")
    from nmem_mailbox_stop import supports_native_cli

    if not executable or not supports_native_cli(executable):
        return
    env = os.environ.copy()
    for name in (
        "NMEM_AGENT_CONTEXT",
        "NMEM_AGENT_ID",
        "NMEM_SPACE",
        "NMEM_SPACE_ID",
        "NMEM_HOST_AGENT_ID",
    ):
        env.pop(name, None)
    subprocess.run(
        [
            executable,
            "--json",
            "bridge",
            "notices",
            "unsubscribe",
            f"--host={host}",
            f"--session-id={session}",
            "--ended",
        ],
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=1,
        check=False,
    )
