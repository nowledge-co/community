/**
 * Always-on behavioral hook — injected via before_prompt_build on EVERY turn.
 *
 * This is the single most impactful change for memory adoption:
 * most LLMs ignore "call this proactively" in tool descriptions,
 * but reliably follow behavioral guidance in prepended context.
 *
 * Cost: ~50 tokens per turn. Negligible.
 *
 * When sessionContext is enabled, guidance is adjusted to note that
 * relevant memories are already injected — reducing redundant searches
 * while keeping the save nudge and thread awareness.
 */

const BASE_GUIDANCE = [
	"<nowledge-mem-guidance>",
	"You have access to the user's personal knowledge graph (Nowledge Mem).",
	"When the conversation produces something worth keeping — a decision made, a preference stated,",
	"something learned, a plan formed, a useful discovery — save it with nowledge_mem_save. Don't wait to be asked.",
	"When prior context would improve your response, search with memory_search.",
	"memory_search also returns relevant past conversation snippets alongside memories.",
	"When a memory has a sourceThreadId, fetch the full conversation with nowledge_mem_thread_fetch.",
	"</nowledge-mem-guidance>",
].join("\n");

const SESSION_CONTEXT_GUIDANCE = [
	"<nowledge-mem-guidance>",
	"You have access to the user's personal knowledge graph (Nowledge Mem).",
	"Relevant memories and your Working Memory have already been injected into this prompt.",
	"Use memory_search only when you need something specific beyond what was auto-recalled.",
	"When the conversation produces something worth keeping — a decision made, a preference stated,",
	"something learned, a plan formed, a useful discovery — save it with nowledge_mem_save. Don't wait to be asked.",
	"When a memory has a sourceThreadId, fetch the full conversation with nowledge_mem_thread_fetch.",
	"</nowledge-mem-guidance>",
].join("\n");

export function buildBehavioralHook(logger, { sessionContext = false } = {}) {
	const guidance = sessionContext ? SESSION_CONTEXT_GUIDANCE : BASE_GUIDANCE;
	return (_event, _ctx) => {
		logger.debug?.("behavioral: injecting guidance");
		return { prependContext: guidance };
	};
}
