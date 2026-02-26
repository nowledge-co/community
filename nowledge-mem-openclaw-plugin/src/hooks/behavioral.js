/**
 * Always-on behavioral hook — injected via before_prompt_build on EVERY turn.
 *
 * This is the single most impactful change for memory adoption:
 * most LLMs ignore "call this proactively" in tool descriptions,
 * but reliably follow behavioral guidance in prepended context.
 *
 * Cost: ~50 tokens per turn. Negligible.
 */

const GUIDANCE = [
	"<nowledge-mem-guidance>",
	"You have access to the user's personal knowledge graph (Nowledge Mem).",
	"When the conversation produces something worth keeping — a decision made, a preference stated,",
	"something learned, a plan formed, a useful discovery — save it with nowledge_mem_save. Don't wait to be asked.",
	"When prior context would improve your response, search with memory_search.",
	"memory_search also returns relevant past conversation snippets alongside memories.",
	"</nowledge-mem-guidance>",
].join("\n");

export function buildBehavioralHook(logger) {
	return (_event, _ctx) => {
		logger.debug?.("behavioral: injecting guidance");
		return { prependContext: GUIDANCE };
	};
}
