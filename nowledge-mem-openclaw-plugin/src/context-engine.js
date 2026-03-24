/**
 * Nowledge Mem Context Engine for OpenClaw.
 *
 * Registers alongside the memory slot (kind: "memory"). When users activate
 * this CE via `plugins.slots.contextEngine: "nowledge-mem"`, it replaces the
 * hook-based approach with the richer CE lifecycle:
 *
 *   assemble()              — behavioral guidance + recalled memories via systemPromptAddition
 *   afterTurn()             — continuous thread capture + triage/distillation (every turn)
 *   compact()               — memory-aware compaction (key decisions preserved in summaries)
 *   prepareSubagentSpawn()  — child sessions inherit relevant memory context
 *   bootstrap()             — pre-warm Working Memory for first assemble
 *
 * When not activated, the existing hooks (behavioral, recall, capture) work
 * as before — full backward compatibility.
 *
 * Design:
 * - ownsCompaction: false — we enhance compaction instructions, not the algorithm
 * - Messages pass through unchanged — we only add systemPromptAddition
 * - State is per-session (keyed by sessionKey) with bounded cache size
 */

import { ceState } from "./ce-state.js";
import { BASE_GUIDANCE, SESSION_CONTEXT_GUIDANCE } from "./hooks/behavioral.js";
import {
	appendOrCreateThread,
	hasSkipMarker,
	matchesExcludePattern,
	triageAndDistill,
} from "./hooks/capture.js";
import {
	MAX_QUERY_LENGTH,
	SHORT_QUERY_THRESHOLD,
	buildRecalledKnowledgeBlock,
	escapeForPrompt,
} from "./hooks/recall.js";

// ---------------------------------------------------------------------------
// Per-session state
// ---------------------------------------------------------------------------

/** Session context cache: sessionKey -> { wm, memories, lastWmFetch } */
const _sessions = new Map();

/** Subagent memory injection: childSessionKey -> { wm, memories } */
const _childContext = new Map();

const MAX_SESSION_ENTRIES = 100;
const MAX_CHILD_ENTRIES = 50;
const WM_CACHE_TTL_MS = 60_000; // 1 min — re-fetch Working Memory after this

// ---------------------------------------------------------------------------
// Query building (adapted for CE's assemble params)
// ---------------------------------------------------------------------------

/**
 * Extract plain text from an AgentMessage content field.
 * AgentMessage content can be string or structured blocks.
 */
function extractText(content) {
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	const parts = [];
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		if (block.type === "text" && typeof block.text === "string") {
			const text = block.text.trim();
			if (text) parts.push(text);
		}
	}
	return parts.join("\n").trim();
}

/**
 * Build a search query from the assemble() params.
 *
 * Uses `prompt` (the user's current input) as the primary signal.
 * Falls back to the last user message in `messages` if prompt is absent.
 * For short queries, augments with recent conversation context.
 */
function buildAssembleSearchQuery(prompt, messages) {
	// Prefer the prompt parameter (the raw user input for this turn)
	let queryText = typeof prompt === "string" ? prompt.trim() : "";

	// Fallback: extract last user message from messages array
	if (!queryText && Array.isArray(messages)) {
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg?.role === "user") {
				queryText = extractText(msg.content);
				break;
			}
		}
	}

	if (!queryText || queryText.length < 3) return "";

	// Substantial query — use alone
	if (queryText.length >= SHORT_QUERY_THRESHOLD) {
		return queryText.slice(0, MAX_QUERY_LENGTH);
	}

	// Short query — augment with recent conversation context for topic grounding
	if (Array.isArray(messages) && messages.length > 1) {
		const contextParts = [];
		const start = Math.max(0, messages.length - 4); // last 3 messages before current
		for (let i = start; i < messages.length - 1; i++) {
			const msg = messages[i];
			if (!msg?.role || (msg.role !== "user" && msg.role !== "assistant"))
				continue;
			const text = extractText(msg.content);
			if (!text) continue;
			contextParts.push(text.length > 150 ? `${text.slice(0, 150)}…` : text);
		}
		if (contextParts.length > 0) {
			return `${queryText}\n\n${contextParts.join("\n")}`.slice(
				0,
				MAX_QUERY_LENGTH,
			);
		}
	}

	return queryText.slice(0, MAX_QUERY_LENGTH);
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

function evictIfNeeded(map, max) {
	if (map.size <= max) return;
	// Evict oldest entries (first inserted)
	const excess = map.size - max;
	let count = 0;
	for (const key of map.keys()) {
		if (count >= excess) break;
		map.delete(key);
		count++;
	}
}

function getSessionState(key) {
	let state = _sessions.get(key);
	if (!state) {
		state = { wm: null, memories: [], lastWmFetch: 0 };
		_sessions.set(key, state);
		evictIfNeeded(_sessions, MAX_SESSION_ENTRIES);
	}
	return state;
}

// ---------------------------------------------------------------------------
// Context Engine factory
// ---------------------------------------------------------------------------

/**
 * Create the CE factory function for api.registerContextEngine().
 *
 * @param {import('./client.js').NowledgeMemClient} client
 * @param {object} cfg  Parsed plugin config
 * @param {object} logger  OpenClaw logger
 * @returns {() => object}  Factory that creates the engine instance
 */
export function createNowledgeMemContextEngineFactory(client, cfg, logger) {
	return () => {
		ceState.active = true;
		logger.info("nowledge-mem: context engine activated");

		return {
			info: {
				id: "nowledge-mem",
				name: "Nowledge Mem",
				version: "0.7.0",
				ownsCompaction: false,
			},

			// ------------------------------------------------------------------
			// bootstrap — pre-warm Working Memory for first assemble()
			// ------------------------------------------------------------------
			async bootstrap({ sessionId, sessionKey }) {
				const key = sessionKey || sessionId;
				try {
					const wm = await client.readWorkingMemory();
					const state = getSessionState(key);
					state.wm = wm;
					state.lastWmFetch = Date.now();
					logger.debug?.(`ce: bootstrap — WM loaded for ${key}`);
					return { bootstrapped: true };
				} catch (err) {
					logger.warn(`ce: bootstrap — WM read failed: ${err}`);
					return { bootstrapped: false, reason: String(err) };
				}
			},

			// ------------------------------------------------------------------
			// ingest / ingestBatch — lightweight; real capture is in afterTurn
			// ------------------------------------------------------------------
			async ingest({ isHeartbeat }) {
				return { ingested: !isHeartbeat };
			},

			async ingestBatch({ messages, isHeartbeat }) {
				return { ingestedCount: isHeartbeat ? 0 : (messages?.length ?? 0) };
			},

			// ------------------------------------------------------------------
			// assemble — behavioral guidance + recalled memories in systemPromptAddition
			//
			// Messages pass through unchanged. We never own message selection —
			// the runtime's sanitize → validate → limit pipeline handles that.
			// ------------------------------------------------------------------
			async assemble({ sessionId, sessionKey, messages, prompt }) {
				const key = sessionKey || sessionId;
				const state = getSessionState(key);
				const sections = [];

				// 1. Behavioral guidance (always — ~50 tokens)
				sections.push(
					cfg.sessionContext ? SESSION_CONTEXT_GUIDANCE : BASE_GUIDANCE,
				);

				// 2. Working Memory (refresh if stale)
				try {
					if (!state.wm || Date.now() - state.lastWmFetch > WM_CACHE_TTL_MS) {
						state.wm = await client.readWorkingMemory();
						state.lastWmFetch = Date.now();
					}
					if (state.wm?.available) {
						sections.push(
							`<working-memory>\n${escapeForPrompt(state.wm.content)}\n</working-memory>`,
						);
					}
				} catch (err) {
					logger.debug?.(`ce: assemble — WM read failed: ${err}`);
				}

				// 3. Recalled memories (when sessionContext enabled)
				if (cfg.sessionContext) {
					const query = buildAssembleSearchQuery(prompt, messages);
					if (query) {
						try {
							const results = await client.searchRich(
								query,
								cfg.maxContextResults,
							);
							const minScore = (cfg.recallMinScore ?? 0) / 100;
							const filtered =
								minScore > 0
									? results.filter((r) => (r.score ?? 0) >= minScore)
									: results;
							if (filtered.length > 0) {
								state.memories = filtered; // cache for compact()
								sections.push(buildRecalledKnowledgeBlock(filtered));
							}
						} catch (err) {
							logger.debug?.(`ce: assemble — recall failed: ${err}`);
						}
					}
				}

				// 4. Subagent memory injection (one-time for child sessions)
				const childCtx = _childContext.get(key);
				if (childCtx) {
					if (childCtx.wm?.available) {
						sections.push(
							`<parent-context>\n${escapeForPrompt(childCtx.wm.content)}\n</parent-context>`,
						);
					}
					if (childCtx.memories?.length > 0) {
						sections.push(
							buildRecalledKnowledgeBlock(
								childCtx.memories,
								"parent-knowledge",
							),
						);
					}
					_childContext.delete(key);
				}

				_sessions.set(key, state);

				const systemPromptAddition =
					sections.length > 1
						? `<nowledge-mem>\n${sections.join("\n\n")}\n</nowledge-mem>`
						: sections.length === 1
							? sections[0] // just the behavioral guidance, skip wrapper
							: undefined;

				return { messages, estimatedTokens: 0, systemPromptAddition };
			},

			// ------------------------------------------------------------------
			// compact — enhance compaction with memory context, then delegate
			//
			// When key decisions/learnings from this conversation have been saved
			// to the knowledge graph, we tell the compactor so it can reference
			// them concisely rather than losing them in summarization.
			// ------------------------------------------------------------------
			async compact(params) {
				const key = params.sessionKey || params.sessionId;
				const state = _sessions.get(key);

				let enhanced = params.customInstructions || "";
				if (state?.memories?.length > 0) {
					const memoryHints = state.memories
						.slice(0, 8)
						.map((m) => {
							const title = m.title || "(untitled)";
							const snippet = (m.content || "").slice(0, 120);
							return `- ${title}: ${snippet}`;
						})
						.join("\n");
					enhanced += `\n\nThe user has the following knowledge saved in their personal knowledge graph (Nowledge Mem). When compacting older messages, reference these items by name rather than repeating them in full — the complete version is preserved in the graph:\n${memoryHints}`;
				}

				try {
					const { delegateCompactionToRuntime } = await import(
						"openclaw/plugin-sdk/core"
					);
					return delegateCompactionToRuntime({
						...params,
						customInstructions: enhanced.trim() || undefined,
					});
				} catch (err) {
					logger.warn(`ce: compact delegation failed: ${err}`);
					// Tell the runtime we couldn't compact — it will handle overflow recovery
					return {
						ok: true,
						compacted: false,
						reason: "delegation-unavailable",
					};
				}
			},

			// ------------------------------------------------------------------
			// afterTurn — continuous thread capture + triage/distillation
			//
			// Fires after every turn (more granular than agent_end hook).
			// The dedup layer in appendOrCreateThread ensures no duplicates.
			// ------------------------------------------------------------------
			async afterTurn({
				sessionId,
				sessionKey,
				sessionFile,
				messages,
				isHeartbeat,
			}) {
				if (isHeartbeat) return;

				// Normalize sessionKey consistently with hook handlers
				const normalizedKey = String(sessionKey || sessionId || "");

				// Capture exclusion: pattern-based and marker-based filters
				if (matchesExcludePattern(normalizedKey, cfg.captureExclude)) {
					logger.debug?.(`ce: skipped excluded session ${normalizedKey}`);
					return;
				}
				if (hasSkipMarker(messages, cfg.captureSkipMarker)) {
					logger.debug?.(
						`ce: skipped session with skip marker ${normalizedKey}`,
					);
					return;
				}

				const event = { messages, sessionFile };
				const ctx = { sessionId, sessionKey: normalizedKey };

				// 1. Always capture thread (idempotent, deduped)
				const captureResult = await appendOrCreateThread({
					client,
					logger,
					event,
					ctx,
					reason: "turn",
					maxMessageChars: cfg.maxThreadMessageChars,
				});

				// 2. Triage + distill (shared logic with agent_end path)
				await triageAndDistill({ client, cfg, logger, captureResult, ctx });
			},

			// ------------------------------------------------------------------
			// prepareSubagentSpawn — propagate memory context to child sessions
			//
			// When OpenClaw spawns parallel research agents, they start without
			// memory context. We inject the parent's Working Memory and recently
			// recalled memories so the child has relevant background.
			// ------------------------------------------------------------------
			async prepareSubagentSpawn({ parentSessionKey, childSessionKey }) {
				try {
					const parentState = _sessions.get(parentSessionKey);
					if (parentState) {
						_childContext.set(childSessionKey, {
							wm: parentState.wm,
							memories: (parentState.memories || []).slice(0, 3),
						});
						evictIfNeeded(_childContext, MAX_CHILD_ENTRIES);
					}
					return {
						rollback: () => _childContext.delete(childSessionKey),
					};
				} catch (err) {
					logger.debug?.(`ce: subagent spawn prep failed: ${err}`);
					return undefined;
				}
			},

			// ------------------------------------------------------------------
			// onSubagentEnded — clean up child context cache
			// ------------------------------------------------------------------
			async onSubagentEnded({ childSessionKey }) {
				_childContext.delete(childSessionKey);
			},

			// ------------------------------------------------------------------
			// dispose — clean up all state
			// ------------------------------------------------------------------
			async dispose() {
				ceState.active = false;
				_sessions.clear();
				_childContext.clear();
				logger.info("nowledge-mem: context engine disposed");
			},
		};
	};
}
