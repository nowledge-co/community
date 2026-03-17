"""Bub hook implementations for Nowledge Mem.

Hooks:
  system_prompt  — behavioural guidance (~50 tokens) + optional WM / recall
  load_state     — fetch Working Memory and (if session_context) recalled memories
  save_state     — capture each turn to a Nowledge Mem thread (incremental)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Any

from bub import hookimpl
from bub.envelope import content_of

from .client import NmemClient, NmemError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Behavioural guidance injected into the system prompt.
# Cost: ~50 tokens.  Adjusts when session_context is on to avoid redundant
# tool calls for context that was already injected.
# ---------------------------------------------------------------------------

_GUIDANCE_BASE = """\
You have access to the user's personal knowledge graph (Nowledge Mem).
It contains knowledge from all their tools — Claude Code, Cursor, ChatGPT, and others — not just this session.
When prior context would improve your response, search with mem.search.
When the conversation produces something worth keeping, save it with mem.save.
When a memory has source_thread_id, fetch the full conversation with mem.thread."""

_GUIDANCE_WITH_CONTEXT = """\
You have access to the user's personal knowledge graph (Nowledge Mem).
It contains knowledge from all their tools — not just this session.
Relevant memories and Working Memory have already been injected into context.
Use mem.search only for specific follow-ups beyond what was auto-recalled.
When the conversation produces something worth keeping, save it with mem.save."""


class NowledgeMemPlugin:
    """Nowledge Mem integration for Bub.

    Configuration (env vars):
      NMEM_SESSION_CONTEXT  — "1"/"true"  to inject WM + recall each turn
      NMEM_SESSION_DIGEST   — "0"/"false" to disable thread capture
      NMEM_API_URL          — remote server URL
      NMEM_API_KEY          — API key (passed to nmem via env, never logged)
    """

    def __init__(self) -> None:
        self.client = NmemClient()
        self._session_context = os.environ.get("NMEM_SESSION_CONTEXT", "").lower() in (
            "1",
            "true",
            "yes",
        )
        self._session_digest = os.environ.get(
            "NMEM_SESSION_DIGEST", "1"
        ).lower() not in ("0", "false", "no")
        self._known_threads: set[str] = set()

    async def _builtin_build_prompt(self, message, session_id, state) -> str:
        agent = state.get("_runtime_agent")
        if agent is None:
            return ""
        parent_caller = agent.framework._plugin_manager.subset_hook_caller(
            "build_prompt", [self]
        )

        return await parent_caller(message=message, session_id=session_id, state=state)

    # ------------------------------------------------------------------
    # system_prompt — sync, call_many, results joined with \n\n
    # ------------------------------------------------------------------
    @hookimpl
    def system_prompt(self, prompt, state) -> str:
        """Inject behavioural guidance and, when session_context is on,
        Working Memory + recalled knowledge from state."""
        # Always: behavioural nudge
        if self._session_context:
            return _GUIDANCE_WITH_CONTEXT
        else:
            return _GUIDANCE_BASE

    # ------------------------------------------------------------------
    # build_prompt — async, call_first, can modify prompt
    # ------------------------------------------------------------------
    @hookimpl
    async def build_prompt(
        self, message, session_id, state
    ) -> list[dict[str, str]] | str:
        """When session_context is on, inject WM + recalled memories into the prompt."""
        prompt = await self._builtin_build_prompt(message, session_id, state)
        if not self._session_context:
            return prompt

        sections = []
        # Session context mode: include WM + recalled memories
        wm, recalled = await self._load_memory(message)
        if wm:
            sections.append(f"<working-memory>\n{wm}\n</working-memory>")

        if recalled:
            lines: list[str] = []
            for r in recalled:
                title = r.get("title", "")
                text = r.get("content", "")[:300]
                mid = r.get("id", "")
                thread = r.get("source_thread_id", "")
                entry = f"- [{title}] {text}"
                if mid:
                    entry += f" (id: {mid})"
                if thread:
                    entry += f" (thread: {thread})"
                lines.append(entry)
            sections.append(
                "<recalled-knowledge>\n" + "\n".join(lines) + "\n</recalled-knowledge>"
            )

        mem_context = "\n\n".join(sections)
        if not prompt:
            return mem_context
        if not isinstance(prompt, list):
            prompt = [{"type": "text", "text": str(prompt)}]
        prompt.insert(0, {"type": "text", "text": mem_context})
        return prompt

    async def _load_memory(self, message) -> tuple[str, list[dict[str, Any]]]:
        """Load Working Memory and recalled memories (when session_context is on)."""

        if not self._session_context:
            # Default mode: no per-turn fetches.  The agent calls
            # mem.context or mem.search on demand.
            return "", []
        if not self.client.is_available():
            logger.debug("nmem not in PATH, skipping load_state")
            return "", []

        # Session context mode: fetch WM + recalled memories
        working_memory, recalled = "", []
        try:
            wm = await self.client.read_working_memory()
            working_memory = wm.get("content", "")
        except Exception as exc:
            logger.debug("working memory read failed: %s", exc)

        # Recall: search for memories relevant to the current message
        query = content_of(message)
        if query and len(query.strip()) > 3:
            try:
                recalled = await self.client.search(query[:500], limit=5)
            except Exception as exc:
                logger.debug("recall search failed: %s", exc)

        return working_memory, recalled

    # ------------------------------------------------------------------
    # save_state — async, call_many, always runs (finally block)
    # ------------------------------------------------------------------

    @hookimpl
    async def save_state(self, session_id, state, message, model_output) -> None:
        """Append the turn (user + assistant) to a Nowledge Mem thread."""
        if not self._session_digest:
            return
        if not self.client.is_available():
            return

        try:
            user_content = content_of(message)
            if not user_content or not model_output:
                return

            digest = hashlib.sha1(session_id.encode()).hexdigest()[:10]
            thread_id = f"bub-{digest}"

            messages = [
                {"role": "user", "content": user_content[:800]},
                {"role": "assistant", "content": str(model_output)[:800]},
            ]
            messages_json = json.dumps(messages)

            if thread_id in self._known_threads:
                await self.client.append_thread(thread_id, messages_json)
            else:
                try:
                    await self.client.append_thread(thread_id, messages_json)
                    self._known_threads.add(thread_id)
                except NmemError as exc:
                    err_msg = str(exc).lower()
                    if "not found" not in err_msg and "404" not in err_msg:
                        raise  # timeout, auth, network — don't mask
                    title = f"Bub Session ({session_id[:30]})"
                    await self.client.create_thread(thread_id, title, messages_json)
                    self._known_threads.add(thread_id)
        except Exception as exc:
            # save_state must never raise — it runs in a finally block
            logger.debug("session capture failed: %s", exc)


plugin = NowledgeMemPlugin()
