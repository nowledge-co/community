"""Nowledge Mem memory provider for Hermes Agent.

Implements the MemoryProvider ABC to give Hermes native access to the
user's cross-tool knowledge graph. Replaces the generic MCP connection
with lifecycle hooks: automatic Working Memory injection, per-turn
recall, user-profile mirroring, and native tool names.

Transport: ``nmem`` CLI only. The CLI handles server URL, API key, and
remote access. If ``nmem`` is not installed, the provider disables
gracefully.
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from agent.memory_provider import MemoryProvider
from tools.registry import tool_error, tool_result

from .client import NowledgeMemClient

logger = logging.getLogger(__name__)

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
one is created. Use this when you have a natural key (for example a topic or \
decision name) instead of the search-then-update dance.

Without an id, search first (nmem_search); if existing knowledge covers the \
topic, use nmem_update rather than create a duplicate."""

_SEARCH = {
    "name": "nmem_search",
    "description": "Search stored memories. Supports label filtering and deep search mode.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query."},
            "limit": {"type": "integer", "description": "Max results, 1-20 (default 10)."},
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
        "Save a decision, insight, procedure, or learning. Pass id to upsert: "
        "update if that ID exists, create if not. Without id, search first to avoid duplicates."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "Memory content."},
            "id": {
                "type": "string",
                "description": "Stable ID for upsert. Omit to auto-generate.",
            },
            "title": {"type": "string", "description": "Descriptive title."},
            "importance": {
                "type": "number",
                "description": "0.0-1.0. 0.8+ major, 0.5-0.7 useful, 0.3-0.4 minor.",
            },
            "labels": {
                "type": "string",
                "description": "Comma-separated labels.",
            },
            "unit_type": {
                "type": "string",
                "description": "fact, preference, decision, plan, procedure, learning, context, or event.",
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
            "memory_id": {"type": "string", "description": "Memory ID from search results."},
            "content": {"type": "string", "description": "Updated content (omit to keep current)."},
            "title": {"type": "string", "description": "Updated title (omit to keep current)."},
            "importance": {"type": "number", "description": "Updated importance (omit to keep current)."},
        },
        "required": ["memory_id"],
    },
}

_DELETE = {
    "name": "nmem_delete",
    "description": "Delete one or more memories. Also removes associated relationships and entity links.",
    "parameters": {
        "type": "object",
        "properties": {
            "memory_id": {"type": "string", "description": "Single memory ID to delete."},
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
    "description": "Search past conversations. Returns threads with matched message snippets.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query."},
            "limit": {"type": "integer", "description": "Max threads, 1-50 (default 10)."},
            "source": {
                "type": "string",
                "description": "Filter by source (for example 'claude-code' or 'hermes').",
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
            "offset": {"type": "integer", "description": "Messages to skip (default 0)."},
            "limit": {"type": "integer", "description": "Max messages, 1-100 (default 50)."},
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


class NowledgeMemProvider(MemoryProvider):
    """Nowledge Mem as a native Hermes memory provider."""

    def __init__(self) -> None:
        self._client: Optional[NowledgeMemClient] = None
        self._working_memory = ""
        self._cron_skipped = False
        self._bg_threads: List[threading.Thread] = []

    @property
    def name(self) -> str:
        return "nowledge-mem"

    def is_available(self) -> bool:
        """Check if nmem CLI is installed. No network calls."""
        return NowledgeMemClient.is_available()

    def initialize(self, session_id: str, **kwargs: Any) -> None:
        agent_context = kwargs.get("agent_context", "")
        platform = kwargs.get("platform", "cli")

        if agent_context in ("cron", "flush") or platform == "cron":
            logger.debug(
                "Nowledge Mem skipped: cron/flush context (agent_context=%s, platform=%s)",
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

        try:
            wm = self._client.working_memory()
            self._working_memory = self._format_working_memory(wm)
        except Exception as error:
            logger.debug("Working memory fetch failed: %s", error)
            self._working_memory = ""

        logger.info("Nowledge Mem provider initialized (CLI transport)")

    def system_prompt_block(self) -> str:
        if self._cron_skipped:
            return ""

        parts = [GUIDANCE]
        if self._working_memory:
            parts.append(f"## Working Memory\n\n{self._working_memory}")
        elif self._client:
            parts.append("## Working Memory\n\nNo briefing available yet. The knowledge graph is connected.")
        else:
            parts.append(
                "## Working Memory\n\nNowledge Mem server is not reachable. Tools are unavailable until the server is running."
            )
        return "\n\n".join(parts)

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        if self._cron_skipped or not self._client:
            return ""
        if not query or len(query.strip()) < 10:
            return ""

        try:
            result = self._client.search(query.strip()[:200], limit=5)
            return self._format_prefetch(result)
        except Exception as error:
            logger.debug("Nowledge Mem prefetch failed: %s", error)
            return ""

    def on_memory_write(self, action: str, target: str, content: str) -> None:
        if self._cron_skipped or not self._client:
            return
        if action != "add" or target != "user" or not content:
            return

        def _save() -> None:
            try:
                self._client.save(
                    content,
                    title="Hermes user profile fact",
                    labels=["hermes", "profile"],
                    unit_type="fact",
                    importance=0.6,
                )
            except Exception as error:
                logger.debug("User profile mirror failed: %s", error)

        thread = threading.Thread(target=_save, daemon=True)
        thread.start()
        self._bg_threads.append(thread)

    def on_pre_compress(self) -> str:
        if self._cron_skipped or not self._client:
            return ""
        return (
            "External knowledge exists in Nowledge Mem. If this session later "
            "needs earlier decisions, procedures, or context, use nmem_search "
            "or nmem_thread_search to recover it."
        )

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        if self._cron_skipped:
            return []
        return ALL_TOOL_SCHEMAS

    def handle_tool_call(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        if not self._client:
            return tool_error("Nowledge Mem is not connected.", success=False)

        try:
            if tool_name == "nmem_search":
                result = self._client.search(
                    args.get("query", ""),
                    limit=int(args.get("limit", 10)),
                    filter_labels=self._parse_csv(args.get("filter_labels")),
                    mode=args.get("mode"),
                )
            elif tool_name == "nmem_save":
                result = self._client.save(
                    args["content"],
                    memory_id=args.get("id"),
                    title=args.get("title"),
                    importance=args.get("importance"),
                    labels=self._parse_csv(args.get("labels")),
                    unit_type=args.get("unit_type"),
                    event_date=args.get("event_date"),
                )
            elif tool_name == "nmem_update":
                result = self._client.update(
                    args["memory_id"],
                    content=args.get("content"),
                    title=args.get("title"),
                    importance=args.get("importance"),
                )
            elif tool_name == "nmem_delete":
                memory_id = args.get("memory_id")
                memory_ids = self._normalize_id_list(args.get("memory_ids"))
                if memory_id and memory_ids:
                    raise ValueError("Provide either memory_id or memory_ids, not both")
                if memory_ids:
                    result = self._client.delete_many(memory_ids)
                elif memory_id:
                    result = self._client.delete(memory_id)
                else:
                    raise ValueError("memory_id or memory_ids is required")
            elif tool_name == "nmem_thread_search":
                result = self._client.thread_search(
                    args.get("query", ""),
                    limit=int(args.get("limit", 10)),
                    source=args.get("source"),
                )
            elif tool_name == "nmem_thread_messages":
                result = self._client.thread_messages(
                    args["thread_id"],
                    limit=int(args.get("limit", 50)),
                    offset=int(args.get("offset", 0)),
                )
            else:
                raise ValueError(f"Unknown tool: {tool_name}")

            return tool_result(self._normalize_tool_result(result))
        except Exception as error:
            logger.debug("Tool %s failed: %s", tool_name, error)
            return tool_error(str(error), success=False, tool=tool_name)

    def save_config(self, config: Dict[str, Any], hermes_home: str) -> None:
        file_path = Path(hermes_home) / "nowledge-mem.json"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(
            json.dumps(
                {
                    "timeout": int(config.get("timeout", 30)),
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    @classmethod
    def get_config_schema(cls) -> Dict[str, Any]:
        return {
            "provider_name": "nowledge-mem",
            "display_name": "Nowledge Mem",
            "description": "Cross-tool memory provider powered by the nmem CLI",
            "fields": [
                {
                    "name": "timeout",
                    "type": "number",
                    "label": "CLI timeout (seconds)",
                    "default": 30,
                    "required": False,
                }
            ],
        }

    @staticmethod
    def _load_timeout(hermes_home: str) -> int:
        if not hermes_home:
            return 30
        file_path = Path(hermes_home) / "nowledge-mem.json"
        if not file_path.exists():
            return 30
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            value = int(data.get("timeout", 30))
            return max(5, min(value, 300))
        except Exception:
            return 30

    @staticmethod
    def _parse_csv(value: Any) -> Optional[List[str]]:
        if value is None:
            return None
        if isinstance(value, str):
            items = [item.strip() for item in value.split(",") if item.strip()]
            return items or None
        if isinstance(value, (list, tuple, set)):
            items = [str(item).strip() for item in value if str(item).strip()]
            return items or None
        text = str(value).strip()
        return [text] if text else None

    @staticmethod
    def _normalize_id_list(value: Any) -> Optional[List[str]]:
        if value is None:
            return None
        if isinstance(value, str):
            text = value.strip()
            return [text] if text else None
        if isinstance(value, (list, tuple, set)):
            items = [str(item).strip() for item in value if str(item).strip()]
            return items or None
        text = str(value).strip()
        return [text] if text else None

    @staticmethod
    def _normalize_tool_result(result: Any) -> Dict[str, Any]:
        if isinstance(result, dict):
            if "success" in result or "error" in result:
                return result
            return {"success": True, **result}
        return {"success": True, "result": result}

    @staticmethod
    def _format_working_memory(result: Dict[str, Any]) -> str:
        content = result.get("content", "")
        if isinstance(content, str) and content.strip():
            return content.strip()
        if result:
            try:
                return json.dumps(result, indent=2, ensure_ascii=False)
            except Exception:
                return str(result)
        return ""

    @staticmethod
    def _format_prefetch(result: Any) -> str:
        memories = []
        if isinstance(result, dict):
            if isinstance(result.get("memories"), list):
                memories = result["memories"][:5]
            elif isinstance(result.get("results"), list):
                memories = result["results"][:5]
        elif isinstance(result, list):
            memories = result[:5]

        lines = []
        for index, memory in enumerate(memories, start=1):
            if not isinstance(memory, dict):
                continue
            title = memory.get("title") or memory.get("id") or f"Memory {index}"
            content = memory.get("content") or memory.get("summary") or ""
            if content:
                lines.append(f"{index}. {title}: {content}")
            else:
                lines.append(f"{index}. {title}")

        if not lines:
            return ""
        return "Relevant knowledge from Nowledge Mem:\n" + "\n".join(lines)
