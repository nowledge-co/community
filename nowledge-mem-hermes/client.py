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
import os
import shutil
import subprocess
from typing import Any, Dict, List, Optional
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest

logger = logging.getLogger(__name__)

DEFAULT_API_URL = "http://127.0.0.1:14242"
CONFIG_PATH = os.path.expanduser("~/.nowledge-mem/config.json")


def _resolve_nmem() -> Optional[str]:
    """Resolve the nmem executable. On Windows, subprocess (shell=False) ignores
    PATHEXT, so a bare "nmem" never matches nmem.CMD; shutil.which honors PATHEXT."""
    return shutil.which("nmem")


def _is_batch(path: str) -> bool:
    """True when the resolved executable is a cmd.exe batch shim (.cmd/.bat).

    Only these run through cmd.exe, whose metacharacter parsing (& | < > ^ ") is
    NOT neutralized by Python's list-form quoting. Native binaries and scripts
    (Linux, macOS, or a real Windows .exe) never touch cmd.exe, so they keep the
    plain list form and behave exactly as before."""
    return os.path.splitext(path)[1].lower() in (".cmd", ".bat")


def _quote_cmd_arg(arg: str) -> str:
    """Escape one token so it survives BOTH cmd.exe's command-line tokenizer and
    the target program's MSVCRT argv parser.

    nmem ships on Windows as a ``.cmd`` shim whose last line forwards every
    argument to a bundled python: ``"%PYTHON%" -m ...ncli %*``. So a single
    command line is parsed twice -- once by cmd.exe, once by the C runtime that
    builds ``sys.argv``. Without this, cmd.exe sees raw ``& | < > ^`` and runs
    injected commands (the BatBadBut / CVE-2024-1874 class), proven live: a bare
    ``a&b`` makes cmd execute ``b``.

    Two layers, both required:
      * MSVCRT argv quoting (Daniel Colascione's algorithm): force-quote EVERY
        token -- even ones without spaces -- and double backslashes that precede
        a quote. Inside double quotes cmd.exe treats ``& | < > ( )`` as literal,
        so force-quoting is what denies cmd.exe any bare metacharacter to act on.
      * Embedded double quotes are emitted as ``""``. That is literal to cmd.exe
        (its quote state simply toggles twice) and collapses to a single ``"``
        under the MSVCRT parser, so an attacker-supplied ``"`` can never close
        the quoted region and break out.

    Verified empirically on Windows against a ``%*``-forwarding shim: every byte
    of ``a&b a|b x^y q"uote a<b>c (paren) 中文记忆 z & echo INJECTED`` round-trips
    verbatim with zero injection.

    Scope: this closes the pure-argv vectors only. It does not (and cannot)
    neutralize ``%VAR%`` expansion, which cmd.exe performs on the assembled
    command line before any token reaches argv -- see :func:`_build_cmd_command`
    for that residual. Literal ``%`` is intentionally left untouched here."""
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
            # Trailing backslashes immediately precede the closing quote: double
            # them so the CRT does not read them as escaping that quote.
            out.append("\\" * (backslashes * 2))
            break
        if arg[i] == '"':
            # Backslashes before a literal quote are doubled; the quote itself
            # becomes "" (literal under both cmd.exe and the MSVCRT parser).
            out.append("\\" * (backslashes * 2))
            out.append('""')
            i += 1
        else:
            out.append("\\" * backslashes)
            out.append(arg[i])
            i += 1
    out.append('"')
    return "".join(out)


def _comspec() -> str:
    """Absolute path to the Windows command processor, guaranteed to be cmd.exe.

    The batch path launches the processor by ABSOLUTE path -- never the bare name
    ``cmd.exe`` -- because ``subprocess.run`` with ``shell=False`` passes a STRING
    command to ``CreateProcess`` with ``executable=None`` and does NOT apply the
    System32/ComSpec hardening that ``shell=True`` would. A bare ``cmd.exe`` would
    therefore be subject to Windows search-path resolution, including the current
    directory (a planting risk).

    Resolution order, each candidate MUST be absolute + existing + basename
    ``cmd.exe`` (case-insensitive). The last fallback is a hard-coded literal so
    a poisoned ``%SystemRoot%`` cannot redirect us to an attacker path:
      1. ``%ComSpec%`` -- the documented Windows variable.
      2. ``%SystemRoot%\\System32\\cmd.exe`` -- iff ``%SystemRoot%`` itself is
         absolute, existing, and the resulting cmd.exe exists.
      3. ``C:\\Windows\\System32\\cmd.exe`` -- the Windows install default,
         used as last resort even when it does not currently exist (callers will
         fail loudly on the subsequent ``CreateProcess`` rather than silently
         picking up something attacker-controlled)."""

    def _is_cmd_exe(path: str) -> bool:
        return (
            os.path.isabs(path)
            and os.path.exists(path)
            and os.path.basename(path).lower() == "cmd.exe"
        )

    comspec = os.environ.get("ComSpec", "")
    if _is_cmd_exe(comspec):
        return comspec

    system_root = os.environ.get("SystemRoot", "")
    if os.path.isabs(system_root) and os.path.exists(system_root):
        candidate = os.path.join(system_root, "System32", "cmd.exe")
        if _is_cmd_exe(candidate):
            return candidate

    return r"C:\Windows\System32\cmd.exe"


def _build_cmd_command(argv: List[str]) -> str:
    """Build a fully-escaped command-processor line for a batch shim.

    Launches the command processor by ABSOLUTE path (see :func:`_comspec`) so
    ``CreateProcess`` does not search PATH or the current directory for
    ``cmd.exe``. The inner command (shim + args) is wrapped in one outer pair of
    quotes and run with ``/s``; per cmd's quoting rules that strips only that
    outer pair and leaves every inner token's quoting intact. The comspec token
    and the ``/d /s /c`` switches sit OUTSIDE that outer pair -- only the inner
    argv line is what ``/s`` unwraps. The string is passed to ``subprocess.run``
    with ``shell=False`` so it reaches ``CreateProcess`` verbatim (Python does
    not re-quote a string command on Windows).

    Threat model -- stated honestly, not reassuringly:
      * Neutralized: the pure-argv BatBadBut / CVE-2024-1874 vectors -- ``& | <
        > ^ "`` supplied DIRECTLY in an argument. Force-quoting every token
        denies cmd.exe any bare metacharacter to act on, and embedded quotes are
        emitted as ``""`` so an argument can never break out of its quoted region.
      * Residual: ``%VAR%`` expansion. cmd.exe expands ``%NAME%`` on the command
        line BEFORE the shim runs, and percent cannot be escaped in the ``/c``
        context that forwards ``%*``. If an argument contains a literal
        ``%NAME%`` AND an environment variable ``NAME`` exists whose value holds
        cmd metacharacters, the expanded value re-enters cmd syntax and can
        execute -- command execution in a poisoned-environment scenario, not
        merely garbled data. Literal ``%`` is deliberately preserved untouched
        (never escaped, doubled, stripped, or rejected) so real memory content
        like ``100% done`` round-trips with zero data loss; a ``%NAME%`` whose
        ``NAME`` is unset is left verbatim. This residual is inherent to
        forwarding arguments through a cmd.exe ``.cmd`` shim and is pinned by the
        regression tests in ``tests/test_windows_batch_args.py``."""
    line = " ".join(_quote_cmd_arg(token) for token in argv)
    return _quote_cmd_arg(_comspec()) + ' /d /s /c "' + line + '"'


def _run_nmem(
    argv: List[str],
    *,
    timeout: float,
    env: Optional[Dict[str, str]] = None,
) -> "subprocess.CompletedProcess[str]":
    """Invoke nmem with the launcher that is safe for the resolved executable.

    Non-batch (Linux/macOS, or a real Windows ``.exe``): the existing list form,
    completely unchanged. Batch (``.cmd``/``.bat`` on Windows): an explicit,
    fully-escaped cmd.exe command string so user/model-controlled metacharacters
    reach nmem as literal data instead of being interpreted by cmd.exe."""
    if _is_batch(argv[0]):
        command = _build_cmd_command(argv)
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout,
            env=env,
        )
    return subprocess.run(
        argv,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=timeout,
        env=env,
    )


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
