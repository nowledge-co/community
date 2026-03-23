/**
 * Always-on behavioral hook — injected via before_prompt_build on EVERY turn.
 *
 * This is the single most impactful change for memory adoption:
 * most LLMs ignore "call this proactively" in tool descriptions,
 * but reliably follow behavioral guidance in system-prompt space.
 *
 * Cost: ~50 tokens per turn. Negligible.
 *
 * When sessionContext is enabled, guidance is adjusted to note that
 * relevant memories are already injected — reducing redundant searches
 * while keeping the save nudge and thread awareness.
 *
 * When the context engine is active, this hook is a no-op —
 * assemble() handles behavioral guidance via systemPromptAddition.
 */

import { ceState } from "../ce-state.js";

export const BASE_GUIDANCE = [
	"<nowledge-mem-guidance>",
	"You have access to the user's personal knowledge graph (Nowledge Mem).",
	"Before answering questions about prior work, decisions, dates, people, preferences, or plans:",
	"search with memory_search using natural language queries (not file paths).",
	"memory_search returns memories with scores, labels, and relevant past conversation snippets.",
	"When results include a sourceThreadId, use nowledge_mem_thread_fetch for full conversation context.",
	"When the conversation produces a decision, preference, plan, or learning, save it with nowledge_mem_save.",
	"</nowledge-mem-guidance>",
].join("\n");

export const SESSION_CONTEXT_GUIDANCE = [
	"<nowledge-mem-guidance>",
	"You have access to the user's personal knowledge graph (Nowledge Mem).",
	"Relevant memories and your Working Memory have already been injected into this prompt.",
	"Use memory_search when you need something specific beyond what was auto-recalled (natural language queries, not file paths).",
	"memory_search also returns relevant past conversation snippets alongside memories.",
	"When results include a sourceThreadId, use nowledge_mem_thread_fetch for full conversation context.",
	"When the conversation produces a decision, preference, plan, or learning, save it with nowledge_mem_save.",
	"</nowledge-mem-guidance>",
].join("\n");

export function buildBehavioralHook(logger, { sessionContext = false } = {}) {
	const guidance = sessionContext ? SESSION_CONTEXT_GUIDANCE : BASE_GUIDANCE;
	return (_event, _ctx) => {
		if (ceState.active) return;
		logger.debug?.("behavioral: injecting guidance");
		return { appendSystemContext: guidance };
	};
}
