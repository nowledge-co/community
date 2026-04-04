"""Dual-transport client for Nowledge Mem.

Prefers the ``nmem`` CLI when available (handles auth, remote URL, API key
out of the box). Falls back to direct HTTP REST when the CLI is not
installed, useful for Hermes built-in distribution where users may not
have ``nmem`` separately.

Domain methods (search, save, update, ...) handle transport dispatch
internally. The caller never needs to know whether CLI or HTTP is used.

No external dependencies: stdlib only (subprocess, urllib).
"""

from __future__ import annotations

import json
import logging
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class NowledgeMemClient:
    """Dual-transport client: nmem CLI (preferred) or HTTP REST (fallback).

    The CLI transport shells out to ``nmem --json <args>``. The CLI already
    handles server URL, API key, and remote access.

    The HTTP transport calls the REST API directly, using a configurable
    URL and optional API key header.

    Domain methods try CLI first when available, falling back to HTTP for
    operations the CLI does not support (labels listing, graph exploration)
    or when CLI arguments are insufficient (empty search query).
    """

    def __init__(
        self,
        url: str = "http://127.0.0.1:14242",
        api_key: str = "",
        timeout: int = 30,
    ) -> None:
        self._url = url.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout
        self.use_cli = self._detect_cli()

    @property
    def transport(self) -> str:
        return "cli" if self.use_cli else "http"

    # ── Domain methods ───────────────────────────────────────────────────

    def health(self) -> bool:
        """Check that the server (or CLI) is reachable."""
        if self.use_cli:
            try:
                r = subprocess.run(
                    ["nmem", "--json", "status"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                return r.returncode == 0
            except Exception:
                return False
        try:
            data = self._http_get("/health")
            return data.get("status") in ("ok", "degraded")
        except Exception:
            return False

    def working_memory(self) -> Dict[str, Any]:
        """Fetch the user's Working Memory briefing."""
        if self.use_cli:
            return self._cli(["wm", "read"])
        return self._http_get("/working-memory")

    def search(
        self,
        query: str = "",
        *,
        limit: int = 10,
        filter_labels: Optional[List[str]] = None,
        mode: Optional[str] = None,
    ) -> Any:
        """Search memories. Omit query to list recent."""
        # CLI requires a positional query; fall back to HTTP for empty query
        if self.use_cli and query:
            cmd = ["m", "search", query]
            if limit != 10:
                cmd.extend(["-n", str(limit)])
            if filter_labels:
                for lbl in filter_labels:
                    cmd.extend(["-l", lbl])
            if mode == "deep":
                cmd.extend(["--mode", "deep"])
            return self._cli(cmd)
        body: dict = {"query": query, "limit": limit}
        if filter_labels:
            body["filter_labels"] = filter_labels
        if mode:
            body["mode"] = mode
        return self._http_post("/memories/search", body)

    def save(
        self,
        content: str,
        *,
        title: Optional[str] = None,
        importance: Optional[float] = None,
        labels: Optional[List[str]] = None,
        unit_type: Optional[str] = None,
        event_date: Optional[str] = None,
    ) -> Any:
        """Save a new memory."""
        if self.use_cli:
            cmd = ["m", "add", content]
            if title:
                cmd.extend(["-t", title])
            if importance is not None:
                cmd.extend(["-i", str(importance)])
            if labels:
                for lbl in labels:
                    cmd.extend(["-l", lbl])
            if unit_type:
                cmd.extend(["--unit-type", unit_type])
            if event_date:
                cmd.extend(["--event-start", event_date])
            return self._cli(cmd)
        body: dict = {"content": content}
        if title:
            body["title"] = title
        if importance is not None:
            body["importance"] = importance
        if labels:
            body["labels"] = labels
        if unit_type:
            body["unit_type"] = unit_type
        if event_date:
            body["event_start"] = event_date
        return self._http_post("/memories", body)

    def update(
        self,
        memory_id: str,
        *,
        content: Optional[str] = None,
        title: Optional[str] = None,
        importance: Optional[float] = None,
        add_labels: Optional[List[str]] = None,
    ) -> Any:
        """Update an existing memory.

        Labels are additive (``add_labels``). The CLI ``nmem m update``
        does not support label changes, so label updates always go
        through HTTP.
        """
        if self.use_cli and not add_labels:
            cmd = ["m", "update", memory_id]
            if content:
                cmd.extend(["-c", content])
            if title:
                cmd.extend(["-t", title])
            if importance is not None:
                cmd.extend(["-i", str(importance)])
            return self._cli(cmd)
        body: dict = {}
        if content:
            body["content"] = content
        if title:
            body["title"] = title
        if importance is not None:
            body["importance"] = importance
        if add_labels:
            body["add_labels"] = add_labels
        return self._http_patch(f"/memories/{memory_id}", body)

    def delete(self, memory_id: str) -> Any:
        """Delete a single memory."""
        if self.use_cli:
            return self._cli(["m", "delete", memory_id, "-f"])
        return self._http_delete(f"/memories/{memory_id}")

    def delete_many(self, memory_ids: List[str]) -> Any:
        """Delete multiple memories."""
        if self.use_cli:
            return self._cli(["m", "delete"] + memory_ids + ["-f"])
        results = []
        for mid in memory_ids:
            results.append(self._http_delete(f"/memories/{mid}"))
        return {"deleted": len(results)}

    def list_labels(self) -> Any:
        """List labels with usage counts. HTTP-only (no CLI command)."""
        return self._http_get("/labels")

    def thread_search(
        self,
        query: str = "",
        *,
        limit: int = 10,
        source: Optional[str] = None,
    ) -> Any:
        """Search past conversations. Omit query to list recent."""
        # CLI requires positional query; fall back to HTTP when empty
        if self.use_cli and query:
            cmd = ["t", "search", query]
            if limit != 10:
                cmd.extend(["-n", str(limit)])
            if source:
                cmd.extend(["--source", source])
            return self._cli(cmd)
        params: Dict[str, str] = {}
        if query:
            params["query"] = query
        if limit != 10:
            params["limit"] = str(limit)
        if source:
            params["source"] = source
        return self._http_get("/threads/search", params)

    def thread_messages(
        self,
        thread_id: str,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> Any:
        """Fetch messages from a thread."""
        if self.use_cli:
            cmd = ["t", "show", thread_id]
            if limit != 50:
                cmd.extend(["-n", str(limit)])
            if offset:
                cmd.extend(["--offset", str(offset)])
            return self._cli(cmd)
        params: Dict[str, str] = {}
        if limit != 50:
            params["limit"] = str(limit)
        if offset:
            params["offset"] = str(offset)
        return self._http_get(f"/threads/{thread_id}", params)

    def neighbors(self, memory_id: str) -> Any:
        """Discover related memories via graph. HTTP-only (no CLI command)."""
        return self._http_get(f"/graph/expand/{memory_id}")

    def evolves(self, memory_id: str) -> Any:
        """Trace how a memory evolved over time. HTTP-only (no CLI command)."""
        return self._http_get("/evolves", {"memory_id": memory_id})

    # ── Transport internals ──────────────────────────────────────────────

    @staticmethod
    def _detect_cli() -> bool:
        try:
            r = subprocess.run(
                ["nmem", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return r.returncode == 0
        except Exception:
            return False

    def _cli(self, args: List[str]) -> Any:
        """Run ``nmem --json <args>`` and return parsed JSON."""
        cmd = ["nmem", "--json"] + args
        try:
            r = subprocess.run(
                cmd, capture_output=True, text=True, timeout=self._timeout
            )
        except FileNotFoundError:
            raise RuntimeError(
                "nmem CLI not found. Install from Nowledge Mem: "
                "Settings > Developer Tools > Install CLI"
            )
        if r.returncode != 0:
            stderr = r.stderr.strip()
            raise RuntimeError(stderr or f"nmem exited with code {r.returncode}")
        output = r.stdout.strip()
        if not output:
            return {}
        try:
            return json.loads(output)
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"nmem returned non-JSON output: {output[:200]}"
            ) from e

    def _http_get(
        self, path: str, params: Optional[Dict[str, str]] = None
    ) -> Any:
        url = f"{self._url}{path}"
        if params:
            qs = urllib.parse.urlencode(
                {k: v for k, v in params.items() if v is not None}
            )
            url = f"{url}?{qs}"
        req = urllib.request.Request(url, headers=self._headers())
        try:
            resp = urllib.request.urlopen(req, timeout=self._timeout)
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"HTTP {e.code} GET {path}: {body_text[:300]}"
            )
        return json.loads(resp.read().decode("utf-8"))

    def _http_post(self, path: str, body: Optional[dict] = None) -> Any:
        return self._http_request("POST", path, body)

    def _http_patch(self, path: str, body: Optional[dict] = None) -> Any:
        return self._http_request("PATCH", path, body)

    def _http_delete(self, path: str) -> Any:
        return self._http_request("DELETE", path)

    def _http_request(
        self, method: str, path: str, body: Optional[dict] = None
    ) -> Any:
        url = f"{self._url}{path}"
        data = json.dumps(body).encode("utf-8") if body else None
        headers = {**self._headers(), "Content-Type": "application/json"}
        req = urllib.request.Request(url, data, headers, method=method)
        try:
            resp = urllib.request.urlopen(req, timeout=self._timeout)
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"HTTP {e.code} {method} {path}: {body_text[:300]}"
            )
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw.strip() else {}

    def _headers(self) -> Dict[str, str]:
        h: Dict[str, str] = {"Accept": "application/json"}
        if self._api_key:
            h["X-API-Key"] = self._api_key
        return h
