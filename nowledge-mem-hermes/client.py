"""Small Nowledge Mem client used by the Hermes provider.

Most operations shell out to ``nmem --json <args>`` so the CLI owns server
URL, API key, and remote access configuration. Thread transcript capture posts
JSON directly to the Mem API so long sessions are not packed into argv.

If ``nmem`` is not installed, ``is_available`` returns False and the
provider gracefully disables tools. On machines running the Nowledge Mem
desktop app, ``nmem`` is already bundled. Otherwise: ``pip install nmem-cli``.

No external dependencies: stdlib only.
"""

from __future__ import annotations

import json
import logging
import ntpath
import os
import re
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest

logger = logging.getLogger(__name__)

DEFAULT_API_URL = "http://127.0.0.1:14242"
CONFIG_PATH = os.path.expanduser("~/.nowledge-mem/config.json")
_CMD_ENV_EXPANSION_RE = re.compile(r"%[A-Za-z_][A-Za-z0-9_]*%")


def _resolve_nmem() -> Optional[str]:
    """Return the absolute path to the ``nmem`` executable, or ``None``.

    ``shutil.which`` honors PATHEXT, so on Windows it correctly resolves the
    ``nmem.CMD`` shim that ``subprocess.run(["nmem", ...], shell=False)`` would
    miss.
    """
    return shutil.which("nmem")


# --- Windows .cmd hardening ------------------------------------------------
# nmem ships on Windows only as ``nmem.CMD``; the shim's last line forwards
# every argument to a bundled python via ``"%PYTHON%" -m ...ncli %*``. Python's
# ``subprocess`` runs ``.cmd``/``.bat`` through ``cmd.exe``, whose metacharacter
# parsing (``& | < > ^ "``) is NOT neutralized by list-form quoting. Live-proven
# on Windows: ``subprocess.run([nmem_cmd, "a&b"])`` makes cmd.exe execute ``b``
# as a separate command. This is the BatBadBut / CVE-2024-1874 class.
#
# Defense (only applied when the resolved executable is .cmd/.bat — Linux/macOS
# and a real Windows .exe keep the plain list form, unchanged):
#   1. Build the inner command line by force-quoting every token with the
#      Daniel Colascione MSVCRT algorithm. Inside double quotes cmd.exe treats
#      ``& | < > ( )`` as literal; embedded ``"`` becomes ``""`` (literal under
#      cmd, collapses to one ``"`` under the MSVCRT parser).
#   2. Launch the command processor by ABSOLUTE path (see ``_comspec``) so
#      ``CreateProcess`` cannot resolve ``cmd.exe`` via PATH or the current
#      directory (a planting risk under ``shell=False``).
#   3. Pass the assembled string to ``subprocess.run(shell=False)`` so Python
#      does not re-quote it.
#
# Percent handling: literal percent text such as ``100% done`` is preserved, but
# ``%NAME%``-style tokens are rejected before cmd.exe can expand environment
# variables. That avoids both data corruption (``%USERNAME%`` changing content)
# and poisoned-environment command injection.


def _is_batch(path: str) -> bool:
    """True iff ``path`` is a cmd.exe batch shim (.cmd/.bat)."""
    return os.path.splitext(path)[1].lower() in (".cmd", ".bat")


def _quote_cmd_arg(arg: str) -> str:
    """Quote ``arg`` for both cmd.exe and the MSVCRT argv parser.

    See the *Windows .cmd hardening* block above for why this is required.
    Force-quotes every token (even spaceless ones); doubles backslashes that
    precede a literal quote; emits embedded ``"`` as ``""``.
    """
    if arg == "":
        return '""'
    out = ['"']
    i, n = 0, len(arg)
    while i < n:
        backslashes = 0
        while i < n and arg[i] == "\\":
            i += 1
            backslashes += 1
        if i == n:
            # Trailing backslashes: double so they don't escape the closing quote.
            out.append("\\" * (backslashes * 2))
            break
        if arg[i] == '"':
            out.append("\\" * (backslashes * 2))
            out.append('""')
            i += 1
        else:
            out.append("\\" * backslashes)
            out.append(arg[i])
            i += 1
    out.append('"')
    return "".join(out)


def _reject_cmd_env_expansion(argv: List[str]) -> None:
    """Reject tokens that cmd.exe would expand as ``%ENV_VAR%``.

    cmd expands these before the batch shim runs, even inside quotes. We cannot
    safely preserve that exact text through ``cmd.exe /c`` without changing the
    real nmem shim, so fail closed for the batch-only path. Ordinary percent
    text without a variable-shaped pair still passes through.
    """
    for arg in argv[1:]:
        if _CMD_ENV_EXPANSION_RE.search(arg):
            raise ValueError(
                "nmem Windows .cmd shim cannot safely receive %VAR%-style "
                "arguments; remove or escape the environment-variable token "
                "before retrying."
            )


def _comspec() -> str:
    """Absolute path to Windows' system ``cmd.exe``.

    A poisoned ``ComSpec`` should not redirect execution. Accept it only when it
    resolves to the same canonical ``%SystemRoot%\\System32\\cmd.exe`` path;
    otherwise use the expected system path directly.
    """
    system_root = os.environ.get("SystemRoot") or r"C:\Windows"
    if not ntpath.isabs(system_root):
        system_root = r"C:\Windows"
    expected = ntpath.join(system_root, "System32", "cmd.exe")

    def _same_windows_path(left: str, right: str) -> bool:
        return ntpath.normcase(ntpath.normpath(left)) == ntpath.normcase(
            ntpath.normpath(right)
        )

    comspec = os.environ.get("ComSpec", "")
    if (
        comspec
        and ntpath.isabs(comspec)
        and ntpath.basename(comspec).lower() == "cmd.exe"
        and _same_windows_path(comspec, expected)
        and os.path.exists(comspec)
    ):
        return comspec

    return expected if os.path.exists(expected) else r"C:\Windows\System32\cmd.exe"


def _build_cmd_command(argv: List[str]) -> str:
    """Build the full ``"<cmd.exe>" /d /s /c "<quoted argv>"`` string.

    The outer ``"..."`` is what ``/s`` strips before re-tokenizing, so every
    inner token's quoting stays intact. See the *Windows .cmd hardening* block
    above for the threat model and residuals.
    """
    _reject_cmd_env_expansion(argv)
    line = " ".join(_quote_cmd_arg(token) for token in argv)
    return _quote_cmd_arg(_comspec()) + ' /d /s /c "' + line + '"'


def _run_nmem(
    argv: List[str],
    *,
    timeout: float,
    env: Optional[Dict[str, str]] = None,
) -> "subprocess.CompletedProcess[str]":
    """Invoke nmem. Routes ``.cmd``/``.bat`` through the hardened cmd.exe path;
    everything else (Linux, macOS, real Windows .exe) keeps the plain list form
    unchanged.
    """
    command: Any = _build_cmd_command(argv) if _is_batch(argv[0]) else argv
    # Hide console window when spawned from pythonw.exe (gateway/desktop)
    popen_kwargs: Dict[str, Any] = {
        "capture_output": True,
        "text": True,
        "encoding": "utf-8",
        "timeout": timeout,
        "env": env,
    }
    if sys.platform == "win32":
        popen_kwargs["creationflags"] = 0x08000000  # CREATE_NO_WINDOW
    return subprocess.run(command, **popen_kwargs)


class NowledgeMemClient:
    """Minimal client for ``nmem`` tools plus large transcript uploads.

    Memory and lookup methods call ``nmem --json <args>``. Thread import/append
    uses the same shared Mem config but sends JSON over HTTP to avoid OS
    argument-length limits on real transcripts.
    """

    def __init__(self, timeout: int = 30, *, space: Optional[str] = None) -> None:
        self._timeout = timeout
        self._has_explicit_space = isinstance(space, str)
        self._space = space.strip() if isinstance(space, str) else None

    @staticmethod
    def is_available() -> bool:
        """Return True if ``nmem`` CLI is on PATH and responds."""
        exe = _resolve_nmem()
        if exe is None:
            return False
        try:
            result = _run_nmem([exe, "--version"], timeout=5)
            return result.returncode == 0
        except Exception:
            return False

    def health(self) -> bool:
        """Check that Nowledge Mem is reachable."""
        exe = _resolve_nmem()
        if exe is None:
            return False
        try:
            result = _run_nmem([exe, "--json", "status"], timeout=5)
            return result.returncode == 0
        except Exception:
            return False

    def working_memory(self) -> Dict[str, Any]:
        """Fetch the user's Working Memory briefing."""
        return self._cli(["wm", "read"])

    def context_bundle(
        self,
        *,
        source_app: Optional[str] = None,
        host_agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch the full startup Context Bundle when supported by the CLI."""
        cmd = ["context"]
        if source_app:
            cmd.extend(["--source-app", source_app])
        if host_agent_id:
            cmd.extend(["--host-agent-id", host_agent_id])
        return self._cli(cmd)

    def search(
        self,
        query: str = "",
        *,
        limit: int = 10,
        filter_labels: Optional[List[str]] = None,
        mode: Optional[str] = None,
        min_importance: Optional[float] = None,
    ) -> Any:
        """Search memories. CLI requires a query string."""
        if not query:
            return {"memories": []}
        cmd = ["m", "search", query]
        if limit != 10:
            cmd.extend(["-n", str(limit)])
        if filter_labels:
            for label in filter_labels:
                cmd.extend(["-l", label])
        if mode == "deep":
            cmd.extend(["--mode", "deep"])
        if min_importance is not None:
            cmd.extend(["--importance", str(min_importance)])
        return self._cli(cmd)

    def save(
        self,
        content: str,
        *,
        memory_id: Optional[str] = None,
        title: Optional[str] = None,
        importance: Optional[float] = None,
        labels: Optional[List[str]] = None,
        unit_type: Optional[str] = None,
        event_date: Optional[str] = None,
    ) -> Any:
        """Save a new memory, or upsert by memory_id."""
        cmd = ["m", "add", content]
        cmd.extend(["-s", "hermes"])
        if memory_id:
            cmd.extend(["--id", memory_id])
        if title:
            cmd.extend(["-t", title])
        if importance is not None:
            cmd.extend(["-i", str(importance)])
        if labels:
            for label in labels:
                cmd.extend(["-l", label])
        if unit_type:
            cmd.extend(["--unit-type", unit_type])
        if event_date:
            cmd.extend(["--event-start", event_date])
        return self._cli(cmd)

    def update(
        self,
        memory_id: str,
        *,
        content: Optional[str] = None,
        title: Optional[str] = None,
        importance: Optional[float] = None,
    ) -> Any:
        """Update an existing memory (content, title, importance)."""
        cmd = ["m", "update", memory_id]
        if content:
            cmd.extend(["-c", content])
        if title:
            cmd.extend(["-t", title])
        if importance is not None:
            cmd.extend(["-i", str(importance)])
        return self._cli(cmd)

    def delete(self, memory_id: str) -> Any:
        """Delete a single memory."""
        return self._cli(["m", "delete", memory_id, "-f"])

    def delete_many(self, memory_ids: List[str]) -> Any:
        """Delete multiple memories."""
        if not memory_ids:
            raise ValueError("memory_ids must not be empty")
        return self._cli(["m", "delete", *memory_ids, "-f"])

    def thread_search(
        self,
        query: str = "",
        *,
        limit: int = 10,
        source: Optional[str] = None,
    ) -> Any:
        """Search past conversations. CLI requires a query string."""
        if not query:
            return {"threads": []}
        cmd = ["t", "search", query]
        if limit != 10:
            cmd.extend(["-n", str(limit)])
        if source:
            cmd.extend(["--source", source])
        return self._cli(cmd)

    def thread_messages(
        self,
        thread_id: str,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> Any:
        """Fetch messages from a thread."""
        cmd = ["t", "show", thread_id]
        cmd.extend(["-n", str(limit)])
        if offset:
            cmd.extend(["--offset", str(offset)])
        return self._cli(cmd)

    def import_thread(
        self,
        thread_id: str,
        messages: List[Dict[str, Any]],
        *,
        title: Optional[str] = None,
        source: str = "hermes",
    ) -> Any:
        """Create or replace a thread from a cleaned transcript batch."""
        if not messages:
            return {"success": True, "thread_id": thread_id, "imported": 0}
        payload: Dict[str, Any] = {
            "thread_id": thread_id,
            "messages": messages,
        }
        if title:
            payload["title"] = title
        if source:
            payload["source"] = source
        if self._has_explicit_space and self._space:
            payload["metadata"] = {"space_id": self._space}
        return self._api_post("/threads/import", payload)

    def append_thread(self, thread_id: str, messages: List[Dict[str, Any]]) -> Any:
        """Append cleaned transcript messages to an existing thread."""
        if not messages:
            return {"success": True, "thread_id": thread_id, "appended": 0}
        path = f"/threads/{urlparse.quote(thread_id, safe='')}/append"
        payload: Dict[str, Any] = {"messages": messages, "deduplicate": True}
        if self._has_explicit_space and self._space:
            payload["space_id"] = self._space
        return self._api_post(path, payload)

    def _cli(self, args: List[str]) -> Any:
        """Run ``nmem --json <args>`` and return parsed JSON."""
        exe = _resolve_nmem()
        if exe is None:
            raise RuntimeError(
                "nmem CLI not found. Install: pip install nmem-cli, "
                "or enable CLI in Nowledge Mem: Settings > Developer Tools"
            )
        cmd = [exe, "--json"] + args
        env = os.environ.copy()
        if self._has_explicit_space:
            env.pop("NMEM_SPACE", None)
            env.pop("NMEM_SPACE_ID", None)
        if self._has_explicit_space and self._space:
            env["NMEM_SPACE"] = self._space
            env["NMEM_SPACE_ID"] = self._space
        try:
            result = _run_nmem(cmd, timeout=self._timeout, env=env)
        except FileNotFoundError:
            raise RuntimeError(
                "nmem CLI not found. Install: pip install nmem-cli, "
                "or enable CLI in Nowledge Mem: Settings > Developer Tools"
            ) from None
        if result.returncode != 0:
            stderr = result.stderr.strip()
            raise RuntimeError(stderr or f"nmem exited with code {result.returncode}")
        output = result.stdout.strip()
        if not output:
            return {}
        try:
            return json.loads(output)
        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"nmem returned non-JSON output: {output[:200]}"
            ) from error

    def _api_post(self, path: str, payload: Dict[str, Any]) -> Any:
        """POST JSON directly to Mem for large transcript payloads.

        Regular memory tools continue to use ``nmem``. Transcript capture uses
        HTTP so long sessions are not serialized into a single argv token.
        """
        api_url = self._api_url().rstrip("/")
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        api_key = self._api_key()
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
            headers["X-NMEM-API-Key"] = api_key

        url = f"{api_url}{path}"
        try:
            return self._request_json(url, body, headers)
        except RuntimeError as first_error:
            # Keep proxy compatibility for configs that accidentally include
            # /remote-api, but never move credentials from headers into URLs.
            for retry_url in self._retry_urls(url):
                try:
                    return self._request_json(retry_url, body, headers)
                except RuntimeError:
                    continue
            raise first_error

    def _request_json(
        self,
        url: str,
        body: bytes,
        headers: Dict[str, str],
    ) -> Any:
        request = urlrequest.Request(url, data=body, headers=headers, method="POST")
        try:
            with urlrequest.urlopen(request, timeout=self._timeout) as response:
                raw = response.read().decode("utf-8")
        except urlerror.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Mem API error {error.code}: {detail[:300]}"
            ) from error
        except urlerror.URLError as error:
            raise RuntimeError(f"Cannot connect to Mem API: {error}") from error

        if not raw.strip():
            return {}
        try:
            return json.loads(raw)
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Mem API returned non-JSON output: {raw[:200]}") from error

    @staticmethod
    def _load_cli_config() -> Dict[str, Any]:
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
                parsed = json.load(handle)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    @classmethod
    def _api_url(cls) -> str:
        env_url = os.environ.get("NMEM_API_URL")
        if env_url:
            return env_url.strip().rstrip("/")
        config = cls._load_cli_config()
        configured = config.get("apiUrl") or config.get("api_url")
        return str(configured or DEFAULT_API_URL).strip().rstrip("/")

    @classmethod
    def _api_key(cls) -> str:
        env_key = os.environ.get("NMEM_API_KEY")
        if env_key is not None:
            return env_key.strip()
        config = cls._load_cli_config()
        return str(config.get("apiKey") or config.get("api_key") or "").strip()

    @staticmethod
    def _retry_urls(url: str) -> List[str]:
        urls: List[str] = []

        def add(candidate: str) -> None:
            if candidate not in urls:
                urls.append(candidate)

        parsed = urlparse.urlsplit(url)
        path = parsed.path or ""
        if path == "/remote-api":
            stripped_path = "/"
        elif path.startswith("/remote-api/"):
            stripped_path = path[len("/remote-api") :]
        else:
            stripped_path = ""
        if stripped_path:
            stripped = parsed._replace(path=stripped_path)
            add(urlparse.urlunsplit(stripped))

        return urls
