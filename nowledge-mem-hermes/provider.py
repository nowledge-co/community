"""Nowledge Mem memory provider for Hermes Agent.

Implements the MemoryProvider ABC to give Hermes native access to the
user's cross-tool knowledge graph. Replaces the generic MCP connection
with lifecycle hooks: automatic Working Memory injection, per-turn
recall, user-profile mirroring, and native tool names.

Transport: ``nmem`` CLI only. The CLI handles server URL, API key, and
remote access. If ``nmem`` is not installed, the provider disables
gracefully.

Requires Hermes v0.7.0+ (MemoryProvider support).
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from agent.memory_provider import MemoryProvider
from .client import NowledgeMemClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Behavioral guidance (injected via system_prompt_block)
# ---------------------------------------------------------------------------

GUIDANCE = """\
# Nowledge Mem
Cross-tool personal knowledge graph. Knowledge saved here persists across \
all tools and sessions.

**Nowledge Mem vs Hermes memory:** Hermes memory stores Hermes-specific \
facts (env details, tool quirks). Nowledge Mem stores cross-tool knowledge: \
decisions, procedures, and learnings. Ask yourself: "Would this matter in a \
Claude Code, Cursor, or Codex session?" If yes, save to Nowledge Mem.

Save proactively when the conversation produces a decision, procedure, \
learning, or important context. One strong memory is better than three \
weak ones.

**Upsert by ID:** pass a stable id to nmem_save to create-or-update in one \
call. If a memory with that ID already exists it is updated; otherwise a new \
one is created. Use this when you have a natural key (e.g. topic or decision \
name) instead of the search-then-update dance.

Without an id, search first (nmem_search); if existing knowledge covers the \
topic, use nmem_update rather than create a duplicate."""


# ---------------------------------------------------------------------------
# Tool schemas (OpenAI function-calling format)
# ---------------------------------------------------------------------------

_SEARCH = {
    "name": "nmem_search",
    "description": (
        "Search stored memories. "
        "Supports label filtering and deep search mode."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query.",
            },
            "limit": {
                "type": "integer",
                "description": "Max results, 1-20 (default 10).",
            },
            "filter_labels": {
                "type": "string",
                "description": "Comma-separated labels to filter by.",
            },
            "mode": {
                "type": "string",
                "description": "'normal' (fast, default) or 'deep' (graph-enhanced).",
            },
        },
        "required": ["query"],
    },
}

_SAVE = {
    "name": "nmem_save",
    "description": (
        "Save a decision, insight, procedure, or learning. "
        "Pass id to upsert: update if that ID exists, create if not. "
        "Without id, search first to avoid duplicates."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "Memory content."},
            "id": {
                "type": "string",
                "description": (
                    "Stable ID for upsert. If a memory with this ID exists "
                    "it is updated; otherwise created with this ID. Omit to "
                    "auto-generate."
                ),
            },
            "title": {"type": "string", "description": "Descriptive title."},
            "importance": {
                "type": "number",
                "description": (
                    "0.0-1.0. 0.8+ major, 0.5-0.7 useful, 0.3-0.4 minor."
                ),
            },
            "labels": {
                "type": "string",
                "description": "Comma-separated labels.",
            },
            "unit_type": {
                "type": "string",
                "description": (
                    "fact, preference, decision, plan, procedure, "
                    "learning, context, or event."
                ),
            },
            "event_date": {
                "type": "string",
                "description": "When it happened (YYYY, YYYY-MM, or YYYY-MM-DD).",
            },
        },
        "required": ["content"],
    },
}

_UPDATE = {
    "name": "nmem_update",
    "description": "Refine an existing memory. Search first to find the memory_id.",
    "parameters": {
        "type": "object",
        "properties": {
            "memory_id": {
                "type": "string",
                "description": "Memory ID from search results.",
            },
            "content": {
                "type": "string",
                "description": "Updated content (omit to keep current).",
            },
            "title": {
                "type": "string",
                "description": "Updated title (omit to keep current).",
            },
            "importance": {
                "type": "number",
                "description": "Updated importance (omit to keep current).",
            },
        },
        "required": ["memory_id"],
    },
}

_DELETE = {
    "name": "nmem_delete",
    "description": (
        "Delete one or more memories. "
        "Also removes associated relationships and entity links."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "memory_id": {
                "type": "string",
                "description": "Single memory ID to delete.",
            },
            "memory_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Multiple memory IDs for bulk delete.",
            },
        },
        "required": [],
    },
}

_THREAD_SEARCH = {
    "name": "nmem_thread_search",
    "description": (
        "Search past conversations. "
        "Returns threads with matched message snippets."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query.",
            },
            "limit": {
                "type": "integer",
                "description": "Max threads, 1-50 (default 10).",
            },
            "source": {
                "type": "string",
                "description": "Filter by source (e.g. 'claude-code', 'hermes').",
            },
        },
        "required": ["query"],
    },
}

_THREAD_MESSAGES = {
    "name": "nmem_thread_messages",
    "description": "Fetch messages from a thread. Use after nmem_thread_search.",
    "parameters": {
        "type": "object",
        "properties": {
            "thread_id": {"type": "string", "description": "Thread ID."},
            "offset": {
                "type": "integer",
                "description": "Messages to skip (default 0).",
            },
            "limit": {
                "type": "integer",
                "description": "Max messages, 1-100 (default 50).",
            },
        },
        "required": ["thread_id"],
    },
}

ALL_TOOL_SCHEMAS = [
    _SEARCH,
    _SAVE,
    _UPDATE,
    _DELETE,
    _THREAD_SEARCH,
    _THREAD_MESSAGES,
]


# ---------------------------------------------------------------------------
# Provider implementation
# ---------------------------------------------------------------------------


class NowledgeMemProvider(MemoryProvider):
    """Nowledge Mem as a native Hermes memory provider.

    Lifecycle hooks replace behavioral guidance with deterministic behavior:
    - system_prompt_block: Working Memory injected automatically
    - prefetch: relevant memories recalled before every turn
    - on_memory_write: user profile facts mirrored to Nowledge Mem
    - on_pre_compress: hints about external knowledge for the compressor
    """

    def __init__(self) -> None:
        self._client: Optional[NowledgeMemClient] = None
        self._working_memory = ""
        self._cron_skipped = False
        self._bg_threads: List[threading.Thread] = []

    @property
    def name(self) -> str:
        return "nowledge-mem"

    # -- Core lifecycle ------------------------------------------------------

    def is_available(self) -> bool:
        """Check if nmem CLI is installed."""
        return NowledgeMemClient.is_available()

    def initialize(self, session_id: str, **kwargs: Any) -> None:
        agent_context = kwargs.get("agent_context", "")
        platform = kwargs.get("platform", "cli")

        if agent_context in ("cron", "flush") or platform == "cron":
            logger.debug(
                "Nowledge Mem skipped: cron/flush context "
                "(agent_context=%s, platform=%s)",
                agent_context,
                platform,
            )
            self._cron_skipped = True
            return

        timeout = self._load_timeout(kwargs.get("hermes_home", ""))
        self._client = NowledgeMemClient(timeout=timeout)

        if not self._client.health():
            logger.warning("Nowledge Mem not reachable via nmem CLI")
            self._client = None
            return

        # Fetch Working Memory for system prompt injection
        try:
            wm = self._client.working_memory()
            self._working_memory = self._format_working_memory(wm)
        except Exception as e:
            logger.debug("Working memory fetch failed: %s", e)
            self._working_memory = ""

        logger.info("Nowledge Mem provider initialized (CLI transport)")

    def system_prompt_block(self) -> str:
        if self._cron_skipped:
            return ""

        parts = [GUIDANCE]

        if self._working_memory:
            parts.append(f"## Working Memory\n\n{self._working_memory}")
        elif self._client:
            parts.append(
                "## Working Memory\n\n"
                "No briefing available yet. The knowledge graph is connected."
            )
        else:
            parts.append(
                "## Working Memory\n\n"
                "Nowledge Mem server is not reachable. "
                "Tools are unavailable until the server is running."
            )

        return "\n\n".join(parts)

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        """Search Nowledge Mem for context relevant to the current turn."""
        if self._cron_skipped or not self._client:
            return ""
        if not query or len(query.strip()) < 10:
            return ""

        try:
            result = self._client.search(query.strip()[:200], limit=5)
            return self._format_prefetch(result)
        except Exception as e:
            logger.debug("Nowledge Mem prefetch failed: %s", e)
            return ""

    def on_memory_write(self, action: str, target: str, content: str) -> None:
        """Mirror Hermes user-profile writes to Nowledge Mem."""
        if self._cron_skipped or not self._client:
            return
        if action != "add" or target != "user" or not content:
            return

        client = self._client  # capture for thread

        def _mirror() -> None:
            try:
                client.save(
                    content,
                    title="User profile (synced from Hermes)",
                    labels=["hermes-profile"],
                    importance=0.5,
                )
                logger.debug("Mirrored user-profile write to Nowledge Mem")
            except Exception as e:
                logger.debug("Mirror write failed (non-fatal): %s", e)

        t = threading.Thread(target=_mirror, daemon=True, name="nmem-mirror")
        t.start()
        self._bg_threads.append(t)

    def on_pre_compress(self, messages: List[Dict[str, Any]]) -> str:
        if self._cron_skipped or not self._client:
            return ""
        return (
            "Cross-session knowledge is stored in Nowledge Mem. "
            "Decisions and insights from compressed messages can be "
            "recovered via nmem_search. Preserve references to memory IDs "
            "if any were mentioned."
        )

    # -- Tools ---------------------------------------------------------------

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        if self._cron_skipped or not self._client:
            return []
        return list(ALL_TOOL_SCHEMAS)

    def handle_tool_call(
        self, tool_name: str, args: Dict[str, Any], **kwargs: Any
    ) -> str:
        if not self._client:
            return json.dumps({"error": "Nowledge Mem is not connected."})

        try:
            result = self._dispatch(tool_name, args)
            return json.dumps(result, ensure_ascii=False, default=str)
        except Exception as e:
            logger.error("Tool %s failed: %s", tool_name, e)
            return json.dumps({"error": f"{tool_name} failed: {e}"})

    def _dispatch(self, tool_name: str, args: Dict[str, Any]) -> Any:
        """Route a tool call to the appropriate client method."""
        assert self._client is not None
        c = self._client

        if tool_name == "nmem_search":
            return c.search(
                args.get("query", ""),
                limit=args.get("limit", 10),
                filter_labels=self._parse_csv(args.get("filter_labels")),
                mode=args.get("mode"),
            )

        if tool_name == "nmem_save":
            return c.save(
                args["content"],
                memory_id=args.get("id"),
                title=args.get("title"),
                importance=args.get("importance"),
                labels=self._parse_csv(args.get("labels")),
                unit_type=args.get("unit_type"),
                event_date=args.get("event_date"),
            )

        if tool_name == "nmem_update":
            return c.update(
                args["memory_id"],
                content=args.get("content"),
                title=args.get("title"),
                importance=args.get("importance"),
            )

        if tool_name == "nmem_delete":
            if args.get("memory_ids"):
                return c.delete_many(args["memory_ids"])
            if args.get("memory_id"):
                return c.delete(args["memory_id"])
            raise ValueError("nmem_delete requires memory_id or memory_ids")

        if tool_name == "nmem_thread_search":
            return c.thread_search(
                args.get("query", ""),
                limit=args.get("limit", 10),
                source=args.get("source"),
            )

        if tool_name == "nmem_thread_messages":
            return c.thread_messages(
                args["thread_id"],
                limit=args.get("limit", 50),
                offset=args.get("offset", 0),
            )

        raise ValueError(f"Unknown tool: {tool_name}")

    # -- Config --------------------------------------------------------------

    def get_config_schema(self) -> List[Dict[str, Any]]:
        return [
            {
                "key": "timeout",
                "description": "Request timeout in seconds",
                "default": "30",
            },
        ]

    def save_config(self, values: Dict[str, Any], hermes_home: str) -> None:
        config_path = Path(hermes_home) / "nowledge-mem.json"
        existing: dict = {}
        if config_path.exists():
            try:
                existing = json.loads(config_path.read_text())
            except Exception:
                pass
        existing.update(values)
        config_path.write_text(json.dumps(existing, indent=2))
        logger.info("Nowledge Mem config saved to %s", config_path)

    # -- Shutdown ------------------------------------------------------------

    def shutdown(self) -> None:
        for t in self._bg_threads:
            if t.is_alive():
                t.join(timeout=3.0)
        self._bg_threads.clear()

    # -- Helpers -------------------------------------------------------------

    @staticmethod
    def _parse_csv(value: Optional[str]) -> Optional[List[str]]:
        """Parse a comma-separated string into a list of trimmed strings."""
        if not value:
            return None
        return [s.strip() for s in value.split(",") if s.strip()]

    @staticmethod
    def _load_timeout(hermes_home: str) -> int:
        """Resolve timeout from config file or default."""
        if hermes_home:
            config_path = Path(hermes_home) / "nowledge-mem.json"
            if config_path.exists():
                try:
                    cfg = json.loads(config_path.read_text())
                    return int(cfg.get("timeout", 30))
                except Exception:
                    pass
        return 30

    @staticmethod
    def _format_working_memory(wm: Any) -> str:
        """Format working memory response for system prompt."""
        if not wm:
            return ""
        if isinstance(wm, dict):
            content = wm.get("content", "") or wm.get("briefing", "")
            if isinstance(content, str) and content.strip():
                return content.strip()
            return json.dumps(wm, indent=2, ensure_ascii=False)
        if isinstance(wm, str):
            return wm.strip()
        return str(wm)

    @staticmethod
    def _format_prefetch(result: Any) -> str:
        """Format search results as injected recall context."""
        if not result or not isinstance(result, dict):
            return ""
        memories = result.get("memories", result.get("results", []))
        if not memories:
            return ""

        lines: List[str] = []
        for m in memories[:5]:
            score = m.get("score", m.get("relevance_score", 0))
            if score < 0.3:
                continue
            title = m.get("title", "Untitled")
            content = (m.get("content", "") or "")[:300]
            labels = m.get("labels", [])
            label_str = f" [{', '.join(labels)}]" if labels else ""
            lines.append(f"- **{title}**{label_str}: {content}")

        if not lines:
            return ""
        return "## Recalled from Nowledge Mem\n" + "\n".join(lines)
