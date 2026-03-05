"""nmem CLI client wrapper.

Executes nmem commands via subprocess with --json output parsing.
Handles the exact JSON output formats documented in nmem-cli.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """A single memory search result."""

    memory_id: str
    title: str
    content: str
    confidence: float
    importance: float
    labels: list[str] = field(default_factory=list)
    created_at: str = ""
    event_start: str = ""
    source: str = ""


@dataclass
class ThreadInfo:
    """Result of thread creation."""

    thread_id: str
    title: str
    message_count: int


@dataclass
class Stats:
    """Database statistics snapshot."""

    memory_count: int
    thread_count: int
    entity_count: int
    community_count: int
    crystal_count: int = 0
    raw: dict[str, Any] = field(default_factory=dict)


class NmemClient:
    """Wrapper around the nmem CLI tool.

    All commands are executed via subprocess with --json flag.
    Field names match the exact nmem CLI JSON output format.
    """

    def __init__(self, nmem_path: str | None = None, api_url: str | None = None):
        self._nmem = nmem_path or self._find_nmem()
        self._api_url = api_url
        self._verify_connection()

    def _find_nmem(self) -> str:
        """Find nmem CLI in PATH or common locations."""
        path = shutil.which("nmem")
        if path:
            return path
        candidates = [
            Path.home() / ".local" / "bin" / "nmem",
            Path("/usr/local/bin/nmem"),
        ]
        for c in candidates:
            if c.exists():
                return str(c)
        raise FileNotFoundError(
            "nmem CLI not found. Install it or pass nmem_path= explicitly."
        )

    def _verify_connection(self) -> None:
        """Verify nmem server is reachable."""
        try:
            self._run(["status"])
            logger.info("nmem connection OK (%s)", self._nmem)
        except Exception as e:
            logger.warning("nmem status check failed: %s", e)

    def _run(
        self,
        args: list[str],
        *,
        json_output: bool = True,
        timeout: int = 300,
    ) -> Any:
        """Execute an nmem command and return parsed output."""
        cmd = [self._nmem]
        if json_output:
            cmd.append("--json")
        if self._api_url:
            cmd.extend(["--api-url", self._api_url])
        cmd.extend(args)

        logger.debug("nmem: %s", " ".join(cmd))
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"nmem failed (exit {result.returncode}): "
                f"{' '.join(args)}\nstderr: {result.stderr[:500]}"
            )

        if not json_output:
            return result.stdout

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            logger.warning("Non-JSON output from nmem: %.200s", result.stdout)
            return {"raw_output": result.stdout}

    # ── Thread operations ──

    def thread_create(
        self,
        title: str,
        content: str | None = None,
        file_path: str | None = None,
        messages_json: str | None = None,
        source: str = "nmem-bench",
    ) -> ThreadInfo:
        """Create a thread.

        nmem JSON output: {"success": true, "id": "...", "title": "...", "messages": N}
        """
        args = ["t", "create", "-t", title, "-s", source]
        if file_path:
            args.extend(["-f", file_path])
        elif messages_json:
            args.extend(["-m", messages_json])
        elif content:
            args.extend(["-c", content])

        data = self._run(args, timeout=60)
        # CLI outputs: id, title, messages (count)
        return ThreadInfo(
            thread_id=data.get("id", data.get("thread_id", "")),
            title=data.get("title", title),
            message_count=data.get("messages", data.get("message_count", 0)),
        )

    def thread_create_from_file(self, title: str, file_path: Path) -> ThreadInfo:
        """Create a thread from a markdown file."""
        return self.thread_create(title=title, file_path=str(file_path))

    def thread_distill(
        self,
        thread_id: str,
        extraction_level: str = "comprehensive",
    ) -> dict[str, Any]:
        """Distill memories from a thread.

        Returns the raw distillation response (memory object + metadata).
        """
        args = [
            "t", "distill", thread_id,
            "--extraction-level", extraction_level,
        ]
        return self._run(args, timeout=180)

    def thread_list(self, limit: int = 50) -> list[dict[str, Any]]:
        """List threads.

        nmem JSON output: {"threads": [...], "total": N}
        """
        data = self._run(["t", "-n", str(limit)])
        if isinstance(data, dict):
            return data.get("threads", [])
        return data

    # ── Memory operations ──

    def memory_search(
        self,
        query: str,
        limit: int = 10,
        mode: str = "normal",
    ) -> list[SearchResult]:
        """Search memories.

        nmem JSON output: {"query": "...", "total": N, "search_mode": "...",
                           "memories": [{id, title, content, score, importance, ...}]}
        """
        args = ["m", "search", query, "-n", str(limit)]
        if mode == "deep":
            args.extend(["--mode", "deep"])

        data = self._run(args)

        # Extract memories array from response
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("memories", data.get("results", []))
        else:
            items = []

        results = []
        for item in items:
            results.append(
                SearchResult(
                    memory_id=item.get("id", ""),
                    title=item.get("title", ""),
                    content=item.get("content", ""),
                    confidence=float(item.get("score", item.get("confidence", 0))),
                    importance=float(item.get("importance", 0.5)),
                    labels=item.get("labels", []),
                    created_at=item.get("created_at", ""),
                    event_start=item.get("event_start", ""),
                    source=item.get("source", ""),
                )
            )
        return results

    def memory_add(
        self,
        content: str,
        title: str = "",
        importance: float = 0.5,
        labels: str = "",
        unit_type: str = "fact",
    ) -> dict[str, Any]:
        """Add a memory directly."""
        args = ["m", "add", content]
        if title:
            args.extend(["-t", title])
        args.extend(["-i", str(importance)])
        if labels:
            args.extend(["-l", labels])
        args.extend(["--unit-type", unit_type])
        return self._run(args)

    # ── System operations ──

    def stats(self) -> Stats:
        """Get database statistics.

        nmem JSON output: {"memories": N, "threads": N, "entities": N, "labels": N, "communities": N}
        """
        data = self._run(["stats"])
        return Stats(
            memory_count=data.get("memories", data.get("memory_count", 0)),
            thread_count=data.get("threads", data.get("thread_count", 0)),
            entity_count=data.get("entities", data.get("entity_count", 0)),
            community_count=data.get("communities", data.get("community_count", 0)),
            crystal_count=data.get("crystals", data.get("crystal_count", 0)),
            raw=data,
        )

    def feed_events(
        self,
        days: int = 7,
        event_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get recent feed events.

        nmem JSON output: {"events": [...], "total": N, "last_n_days": N}
        """
        args = ["f", "--days", str(days)]
        if event_type:
            args.extend(["--type", event_type])
        data = self._run(args)
        if isinstance(data, dict):
            return data.get("events", [])
        return data

    def wait_for_processing(
        self,
        initial_stats: Stats | None = None,
        timeout: int = 300,
        poll_interval: int = 10,
    ) -> Stats:
        """Wait for background processing to settle.

        Polls stats until memory and entity counts stabilize
        (unchanged for 2 consecutive intervals).
        """
        if initial_stats is None:
            initial_stats = self.stats()

        last_memory_count = initial_stats.memory_count
        last_entity_count = initial_stats.entity_count
        stable_count = 0
        elapsed = 0

        while elapsed < timeout:
            time.sleep(poll_interval)
            elapsed += poll_interval

            current = self.stats()
            if (
                current.memory_count == last_memory_count
                and current.entity_count == last_entity_count
            ):
                stable_count += 1
                if stable_count >= 2:
                    logger.info("Processing settled after %ds", elapsed)
                    return current
            else:
                stable_count = 0
                last_memory_count = current.memory_count
                last_entity_count = current.entity_count
                logger.debug(
                    "Processing: memories=%d, entities=%d",
                    current.memory_count,
                    current.entity_count,
                )

        logger.warning("Processing did not settle within %ds", timeout)
        return self.stats()
