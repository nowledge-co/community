"""Nowledge Mem tools for Bub agents.

Tools are registered in ``bub.tools.REGISTRY`` on import via the ``@tool``
decorator.  The plugin's ``__init__.py`` imports this module to trigger
registration.

Naming follows Bub conventions: ``mem.*`` namespace, dot-separated.
In the model's tool list dots become underscores (``mem_search``, etc.).
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from bub import tool

from .client import NmemClient, NmemError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_client(context: Any) -> NmemClient:
    """Retrieve NmemClient from tool context state, or create a fresh one."""
    client = context.state.get("_nmem_client")
    if client is None:
        client = NmemClient()
    return client


def _fmt_memory(m: dict) -> str:
    """Format one memory result for the agent."""
    mid = m.get("id", "")
    title = m.get("title", "")
    text = m.get("content", "")
    score = m.get("score", "")
    labels = m.get("labels", [])
    thread = m.get("source_thread_id", "")
    parts = [f"[{title}]" if title else "", text[:400]]
    if score:
        parts.append(f"score: {score}")
    if labels:
        parts.append(f"labels: {', '.join(labels)}")
    if mid:
        parts.append(f"id: {mid}")
    if thread:
        parts.append(f"thread: {thread}")
    return " · ".join(p for p in parts if p)


# ---------------------------------------------------------------------------
# mem.search
# ---------------------------------------------------------------------------


class MemSearchInput(BaseModel):
    query: str = Field(..., description="Search query.")
    limit: int = Field(5, description="Max results (1–20).")
    labels: list[str] = Field(
        default_factory=list, description="Filter by labels."
    )
    event_from: str | None = Field(
        None, description="Event start date filter (ISO, e.g. 2025-01)."
    )
    event_to: str | None = Field(
        None, description="Event end date filter (ISO)."
    )


@tool(context=True, name="mem.search", model=MemSearchInput)
async def mem_search(param: MemSearchInput, *, context: Any) -> str:
    """Search your personal knowledge graph.  Returns memories ranked by relevance.  Use when prior context would help."""
    client = _get_client(context)
    results = await client.search(
        param.query,
        limit=param.limit,
        labels=param.labels or None,
        event_from=param.event_from,
        event_to=param.event_to,
    )
    if not results:
        return "(no matches)"
    lines = [_fmt_memory(r) for r in results]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# mem.save
# ---------------------------------------------------------------------------


class MemSaveInput(BaseModel):
    content: str = Field(..., description="Memory content to save.")
    title: str | None = Field(None, description="Short descriptive title.")
    importance: float = Field(
        0.7, description="Importance 0.0–1.0. 0.8+ critical, 0.5–0.7 useful."
    )
    labels: list[str] = Field(
        default_factory=list, description="Topic labels (0–3 recommended)."
    )
    unit_type: str = Field(
        "fact",
        description="Type: fact, decision, learning, preference, plan, procedure, context, event.",
    )
    event_start: str | None = Field(
        None, description="When it happened (ISO date)."
    )
    event_end: str | None = Field(
        None, description="End date if range (ISO)."
    )
    temporal_context: str = Field(
        "present", description="past, present, future, or timeless."
    )


@tool(context=True, name="mem.save", model=MemSaveInput)
async def mem_save(param: MemSaveInput, *, context: Any) -> str:
    """Save a memory (decision, insight, preference, plan, …) to your knowledge graph.  Check for duplicates before saving."""
    client = _get_client(context)

    # Pre-save dedup: search for high-similarity existing memory
    try:
        check_query = param.title or param.content[:200]
        existing = await client.search(check_query, limit=3)
        for r in existing:
            score = r.get("score", 0)
            if isinstance(score, (int, float)) and score >= 0.9:
                mid = r.get("id", "unknown")
                title = r.get("title", "")
                return (
                    f"(duplicate detected — existing memory: [{title}] id: {mid})"
                )
    except Exception:
        pass  # dedup is best-effort

    result = await client.add_memory(
        param.content,
        title=param.title,
        importance=param.importance,
        labels=param.labels or None,
        unit_type=param.unit_type,
        event_start=param.event_start,
        event_end=param.event_end,
        temporal_context=param.temporal_context,
    )
    mid = result.get("id", "")
    title = param.title or param.content[:40]
    label_str = ", ".join(param.labels) if param.labels else ""
    parts = [f"Saved: {title} [{param.unit_type}]"]
    if mid:
        parts.append(f"id: {mid}")
    if label_str:
        parts.append(f"labels: {label_str}")
    return " · ".join(parts)


# ---------------------------------------------------------------------------
# mem.context — Working Memory
# ---------------------------------------------------------------------------


@tool(context=True, name="mem.context")
async def mem_context(*, context: Any) -> str:
    """Read today's Working Memory briefing: focus areas, priorities, recent activity."""
    # Check if already loaded in state
    wm = context.state.get("_nmem_working_memory")
    if wm:
        return wm

    client = _get_client(context)
    result = await client.read_working_memory()
    content = result.get("content", "")
    return content or "(no Working Memory available)"


# ---------------------------------------------------------------------------
# mem.connections — graph exploration
# ---------------------------------------------------------------------------


class MemConnectionsInput(BaseModel):
    memory_id: str | None = Field(
        None, description="Memory ID to explore.  If omitted, searches by query."
    )
    query: str | None = Field(
        None,
        description="Search query (used when memory_id is not provided).",
    )


@tool(context=True, name="mem.connections", model=MemConnectionsInput)
async def mem_connections(param: MemConnectionsInput, *, context: Any) -> str:
    """Explore how a memory connects to other knowledge: related topics, version chains (EVOLVES), source documents."""
    client = _get_client(context)

    mid = param.memory_id
    if not mid:
        if not param.query:
            return "(provide memory_id or query)"
        results = await client.search(param.query, limit=1)
        if not results:
            return "(no matching memory found)"
        mid = results[0].get("id", "")
        if not mid:
            return "(no memory ID in result)"

    sections: list[str] = []

    # Neighbours
    try:
        expand = await client.graph_expand(mid)
        nodes = expand.get("nodes", expand.get("neighbors", []))
        if nodes:
            lines = []
            for n in nodes[:15]:
                label = n.get("label", n.get("title", ""))
                nid = n.get("id", "")
                edge = n.get("edge_type", n.get("relationship", ""))
                lines.append(f"  - {label} ({edge}) id: {nid}")
            sections.append("Connections:\n" + "\n".join(lines))
    except Exception as exc:
        logger.debug("graph expand failed: %s", exc)

    # EVOLVES chain
    try:
        evolves = await client.graph_evolves(mid)
        chain = evolves.get("chain", evolves.get("evolves", []))
        if chain:
            lines = []
            for e in chain[:10]:
                title = e.get("title", "")
                eid = e.get("id", "")
                rel = e.get("relationship", e.get("type", ""))
                lines.append(f"  - {title} ({rel}) id: {eid}")
            sections.append("Evolution:\n" + "\n".join(lines))
    except Exception as exc:
        logger.debug("graph evolves failed: %s", exc)

    return "\n\n".join(sections) if sections else "(no connections found)"


# ---------------------------------------------------------------------------
# mem.timeline — activity feed
# ---------------------------------------------------------------------------


class MemTimelineInput(BaseModel):
    last_n_days: int = Field(7, description="Number of recent days (1–90).")
    date_from: str | None = Field(None, description="Start date (ISO).")
    date_to: str | None = Field(None, description="End date (ISO).")


@tool(context=True, name="mem.timeline", model=MemTimelineInput)
async def mem_timeline(param: MemTimelineInput, *, context: Any) -> str:
    """Show recent activity: memories created, conversations captured, insights generated.  Grouped by day."""
    client = _get_client(context)
    events = await client.feed_events(
        days=param.last_n_days,
        date_from=param.date_from,
        date_to=param.date_to,
    )
    if not events:
        return "(no recent activity)"

    lines: list[str] = []
    current_date = ""
    for ev in events[:50]:
        date = ev.get("date", ev.get("created_at", ""))[:10]
        if date != current_date:
            current_date = date
            lines.append(f"\n## {date}")
        etype = ev.get("type", ev.get("event_type", ""))
        title = ev.get("title", ev.get("summary", ""))
        mid = ev.get("memory_id", "")
        entry = f"- {etype}: {title}"
        if mid:
            entry += f" (id: {mid})"
        lines.append(entry)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# mem.forget
# ---------------------------------------------------------------------------


@tool(context=True, name="mem.forget")
async def mem_forget(memory_id: str, *, context: Any) -> str:
    """Delete a memory by ID."""
    client = _get_client(context)
    await client.delete_memory(memory_id)
    return f"deleted: {memory_id}"


# ---------------------------------------------------------------------------
# mem.threads — search past conversations
# ---------------------------------------------------------------------------


@tool(context=True, name="mem.threads")
async def mem_thread_search(
    query: str, limit: int = 5, *, context: Any
) -> str:
    """Search past conversations by keyword.  Returns threads with matched message snippets."""
    client = _get_client(context)
    threads = await client.search_threads(query, limit=limit)
    if not threads:
        return "(no matching threads)"
    lines: list[str] = []
    for t in threads:
        tid = t.get("id", t.get("thread_id", ""))
        title = t.get("title", "")
        msgs = t.get("message_count", t.get("total_messages", ""))
        snippet = t.get("snippet", t.get("matched_text", ""))[:200]
        entry = f"- [{title}] ({msgs} messages) id: {tid}"
        if snippet:
            entry += f"\n  {snippet}"
        lines.append(entry)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# mem.thread — fetch full conversation
# ---------------------------------------------------------------------------


@tool(context=True, name="mem.thread")
async def mem_thread_fetch(
    thread_id: str,
    offset: int = 0,
    limit: int = 20,
    *,
    context: Any,
) -> str:
    """Fetch messages from a specific thread (conversation).  Supports pagination."""
    client = _get_client(context)
    result = await client.fetch_thread(thread_id, limit=limit, offset=offset)

    title = result.get("title", "")
    total = result.get("total_messages", result.get("message_count", "?"))
    messages = result.get("messages", [])
    has_more = result.get("has_more", len(messages) >= limit)

    lines = [f"Thread: {title} ({total} messages)"]
    for msg in messages:
        role = msg.get("role", "")
        text = msg.get("content", "")[:600]
        lines.append(f"[{role}] {text}")

    if has_more:
        next_offset = offset + len(messages)
        lines.append(f"\n(more messages available — use offset={next_offset})")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# mem.status — diagnostics
# ---------------------------------------------------------------------------


@tool(context=True, name="mem.status")
async def mem_status(*, context: Any) -> str:
    """Check Nowledge Mem connection status and configuration."""
    client = _get_client(context)
    try:
        return await client.status()
    except NmemError as exc:
        return f"(connection failed: {exc})"
