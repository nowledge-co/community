"""Async wrapper around the nmem CLI.

All memory operations route through ``nmem`` so that Access Anywhere
(remote config via ``~/.nowledge-mem/config.json`` or ``NMEM_API_URL``)
works transparently.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)


class NmemError(Exception):
    """Error from nmem CLI execution."""


class NmemClient:
    """Async subprocess wrapper for the ``nmem`` CLI."""

    def __init__(self) -> None:
        self._cmd: str | None = None
        self._api_url: str | None = None
        self._api_key: str | None = None
        self._load_config()

    # ------------------------------------------------------------------
    # Config
    # ------------------------------------------------------------------

    def _load_config(self) -> None:
        """Load config.  Priority: env vars > config file > defaults."""
        file_config: dict = {}
        config_path = Path.home() / ".nowledge-mem" / "config.json"
        if config_path.is_file():
            try:
                file_config = json.loads(config_path.read_text(encoding="utf-8"))
            except Exception:
                logger.warning("failed to parse %s", config_path)

        self._api_url = (
            os.environ.get("NMEM_API_URL")
            or file_config.get("apiUrl")
            or file_config.get("api_url")
            or None
        )
        self._api_key = (
            os.environ.get("NMEM_API_KEY")
            or file_config.get("apiKey")
            or file_config.get("api_key")
            or None
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_cmd(self) -> str:
        if self._cmd is not None:
            return self._cmd
        cmd = shutil.which("nmem")
        if cmd:
            self._cmd = cmd
            return cmd
        raise NmemError(
            "nmem not found in PATH. Install with: pip install nmem-cli"
        )

    def _build_env(self) -> dict[str, str]:
        env = dict(os.environ)
        if self._api_key:
            env["NMEM_API_KEY"] = self._api_key
        return env

    def _base_args(self, *, json_output: bool = True) -> list[str]:
        args = [self._resolve_cmd()]
        if json_output:
            args.append("--json")
        if self._api_url:
            args.extend(["--api-url", self._api_url])
        return args

    def is_available(self) -> bool:
        return shutil.which("nmem") is not None

    async def _exec(
        self,
        *args: str,
        json_output: bool = True,
        timeout: float = 15,
    ) -> str:
        cmd = [*self._base_args(json_output=json_output), *args]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self._build_env(),
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError:
            proc.kill()  # type: ignore[union-attr]
            raise NmemError(f"nmem timed out after {timeout}s")
        except FileNotFoundError:
            raise NmemError("nmem not found in PATH")

        if proc.returncode != 0:
            err = stderr.decode(errors="replace").strip()
            raise NmemError(f"nmem exited {proc.returncode}: {err}")

        return stdout.decode(errors="replace").strip()

    async def _exec_json(self, *args: str, timeout: float = 15) -> dict | list:
        raw = await self._exec(*args, json_output=True, timeout=timeout)
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise NmemError(f"invalid JSON from nmem: {e}")

    # ------------------------------------------------------------------
    # Memory operations
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        limit: int = 5,
        *,
        labels: list[str] | None = None,
        importance: float | None = None,
        event_from: str | None = None,
        event_to: str | None = None,
        mode: str | None = None,
    ) -> list:
        args = ["m", "search", query, "-n", str(limit)]
        if importance is not None:
            args.extend(["--importance", str(importance)])
        for label in labels or []:
            args.extend(["-l", label])
        if event_from:
            args.extend(["--event-from", event_from])
        if event_to:
            args.extend(["--event-to", event_to])
        if mode:
            args.extend(["--mode", mode])
        result = await self._exec_json(*args)
        if isinstance(result, list):
            return result
        return result.get("results", result.get("memories", []))

    async def add_memory(
        self,
        content: str,
        *,
        title: str | None = None,
        importance: float | None = None,
        labels: list[str] | None = None,
        unit_type: str | None = None,
        event_start: str | None = None,
        event_end: str | None = None,
        temporal_context: str | None = None,
    ) -> dict:
        args = ["m", "add", content]
        if title:
            args.extend(["-t", title])
        if importance is not None:
            args.extend(["-i", str(importance)])
        for label in labels or []:
            args.extend(["-l", label])
        if unit_type:
            args.extend(["--unit-type", unit_type])
        if event_start:
            args.extend(["--event-start", event_start])
        if event_end:
            args.extend(["--event-end", event_end])
        if temporal_context:
            args.extend(["--temporal-context", temporal_context])
        args.extend(["-s", "bub"])
        result = await self._exec_json(*args)
        return result if isinstance(result, dict) else {}

    async def delete_memory(self, memory_id: str) -> dict:
        result = await self._exec_json("m", "delete", memory_id, "-f")
        return result if isinstance(result, dict) else {}

    async def get_memory(self, memory_id: str) -> dict:
        result = await self._exec_json("m", "show", memory_id)
        return result if isinstance(result, dict) else {}

    # ------------------------------------------------------------------
    # Working Memory
    # ------------------------------------------------------------------

    async def read_working_memory(self) -> dict:
        try:
            result = await self._exec_json("wm", "read")
            return result if isinstance(result, dict) else {"content": ""}
        except NmemError:
            wm_path = Path.home() / "ai-now" / "memory.md"
            if wm_path.is_file():
                return {
                    "content": wm_path.read_text(encoding="utf-8"),
                    "available": True,
                }
            return {"content": "", "available": False}

    # ------------------------------------------------------------------
    # Graph
    # ------------------------------------------------------------------

    async def graph_expand(
        self, memory_id: str, depth: int = 1, limit: int = 20
    ) -> dict:
        result = await self._exec_json(
            "g", "expand", memory_id, "--depth", str(depth), "-n", str(limit)
        )
        return result if isinstance(result, dict) else {}

    async def graph_evolves(self, memory_id: str, limit: int = 10) -> dict:
        result = await self._exec_json(
            "g", "evolves", memory_id, "-n", str(limit)
        )
        return result if isinstance(result, dict) else {}

    # ------------------------------------------------------------------
    # Feed
    # ------------------------------------------------------------------

    async def feed_events(
        self,
        days: int = 7,
        *,
        event_type: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list:
        args = ["f", "--last-n-days", str(days)]
        if event_type:
            args.extend(["--type", event_type])
        if date_from:
            args.extend(["--date-from", date_from])
        if date_to:
            args.extend(["--date-to", date_to])
        result = await self._exec_json(*args)
        if isinstance(result, list):
            return result
        return result.get("events", []) if isinstance(result, dict) else []

    # ------------------------------------------------------------------
    # Threads
    # ------------------------------------------------------------------

    async def search_threads(
        self, query: str, limit: int = 5, source: str | None = None
    ) -> list:
        args = ["t", "search", query, "--limit", str(limit)]
        if source:
            args.extend(["--source", source])
        result = await self._exec_json(*args)
        if isinstance(result, list):
            return result
        return result.get("threads", []) if isinstance(result, dict) else []

    async def fetch_thread(
        self, thread_id: str, limit: int = 20, offset: int = 0
    ) -> dict:
        args = ["t", "show", thread_id, "-m", str(limit)]
        if offset > 0:
            args.extend(["--offset", str(offset)])
        args.extend(["--content-limit", "1200"])
        result = await self._exec_json(*args)
        return result if isinstance(result, dict) else {}

    async def create_thread(
        self, thread_id: str, title: str, messages_json: str
    ) -> dict:
        result = await self._exec_json(
            "t", "create", "--id", thread_id, "-t", title,
            "-m", messages_json, "-s", "bub",
        )
        return result if isinstance(result, dict) else {}

    async def append_thread(self, thread_id: str, messages_json: str) -> dict:
        result = await self._exec_json(
            "t", "append", thread_id, "-m", messages_json,
        )
        return result if isinstance(result, dict) else {}

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    async def status(self) -> str:
        return await self._exec("status", json_output=False)
