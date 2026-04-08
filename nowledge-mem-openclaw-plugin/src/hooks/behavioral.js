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
	"Search proactively with memory_search when past context would improve your answer. Do not wait to be asked. Use natural language queries, not file paths.",
	"When results include a sourceThreadId, use nowledge_mem_thread_fetch for full conversation context.",
	"Save autonomously with nowledge_mem_save when the conversation produces a decision, preference, plan, procedure, or learning. Do not wait to be asked.",
	"</nowledge-mem-guidance>",
].join("\n");

export const SESSION_CONTEXT_GUIDANCE = [
	"<nowledge-mem-guidance>",
	"You have access to the user's personal knowledge graph (Nowledge Mem).",
	"Relevant memories and your Working Memory have already been injected into this prompt.",
	"Use memory_search for specifics beyond what was auto-recalled, or when the user references prior work not covered above. Natural language queries, not file paths.",
	"When results include a sourceThreadId, use nowledge_mem_thread_fetch for full conversation context.",
	"Save autonomously with nowledge_mem_save when the conversation produces a decision, preference, plan, procedure, or learning. Do not wait to be asked.",
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
