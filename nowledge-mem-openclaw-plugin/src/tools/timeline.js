/**
 * nowledge_mem_timeline — browse recent activity from the feed.
 *
 * Wraps GET /agent/feed/events with human-readable grouping by day.
 * Answers questions like:
 * - "What was I working on last week?"
 * - "What happened yesterday?"
 * - "Show me insights from the past 3 days"
 * - "What memories did I save this month?"
 *
 * The feed records every meaningful event: memories saved, documents
 * ingested, insights generated, daily briefings, crystals created.
 * This gives a chronological picture of what the user has been doing.
 */

const EVENT_TYPE_LABELS = {
	memory_created: "Memory saved",
	insight_generated: "Insight",
	pattern_detected: "Pattern",
	agent_observation: "Observation",
	daily_briefing: "Daily briefing",
	crystal_created: "Crystal",
	flag_contradiction: "Flag: contradiction",
	flag_stale: "Flag: stale",
	flag_merge_candidate: "Flag: duplicate",
	flag_review: "Flag: review",
	source_ingested: "Document ingested",
	source_extracted: "Knowledge extracted from document",
	working_memory_updated: "Working Memory updated",
	evolves_detected: "Knowledge evolution detected",
	kg_extraction: "Entity extraction",
	url_captured: "URL captured",
};

function labelForType(eventType) {
	return EVENT_TYPE_LABELS[eventType] || eventType;
}

// Tier-1 events are high-signal user-facing ones
const TIER1_TYPES = new Set([
	"memory_created",
	"insight_generated",
	"pattern_detected",
	"agent_observation",
	"daily_briefing",
	"crystal_created",
	"flag_contradiction",
	"flag_stale",
	"flag_merge_candidate",
	"source_ingested",
	"source_extracted",
	"url_captured",
]);

export function createTimelineTool(client, logger) {
	return {
		name: "nowledge_mem_timeline",
		description:
			"Browse the user's recent knowledge activity — what they saved, read, worked on, or learned. " +
			"Use for temporal questions like 'what was I doing last week?', 'what did I work on yesterday?', " +
			"'show me recent insights', or 'what documents did I add this month?'. " +
			"Returns a day-by-day feed grouped chronologically. Results include memoryIds so you can " +
			"pass them directly to memory_get or nowledge_mem_connections for deeper exploration. " +
			"Use event_type to filter: memory_created (saved knowledge), crystal_created (synthesized insights), " +
			"insight_generated (agent observations), source_ingested (Library documents), " +
			"source_extracted (knowledge from docs), daily_briefing (morning briefings), url_captured. " +
			"For exact date queries ('what was I doing last Tuesday?') use date_from + date_to (YYYY-MM-DD).",
		parameters: {
			type: "object",
			properties: {
				last_n_days: {
					type: "integer",
					description:
						"How many days back to look. 1=today, 7=this week, 30=this month. Default: 7. Ignored when date_from is set.",
				},
				date_from: {
					type: "string",
					description:
						"Exact start date YYYY-MM-DD. Use with date_to for a precise range ('last Tuesday' → compute the date).",
				},
				date_to: {
					type: "string",
					description:
						"Exact end date YYYY-MM-DD (inclusive). Defaults to today when date_from is set.",
				},
				event_type: {
					type: "string",
					description:
						"Filter to a specific event type: memory_created, insight_generated, source_ingested, " +
						"source_extracted, daily_briefing, crystal_created, url_captured",
				},
				tier1_only: {
					type: "boolean",
					description:
						"Only show high-signal events (memories, insights, documents). Default: true.",
				},
			},
		},
		async execute(_toolCallId, params) {
			const safeParams = params && typeof params === "object" ? params : {};
			const lastNDays = Math.min(
				365,
				Math.max(1, Math.trunc(Number(safeParams.last_n_days ?? 7) || 7)),
			);
			const dateFrom = safeParams.date_from
				? String(safeParams.date_from).trim()
				: undefined;
			const dateTo = safeParams.date_to
				? String(safeParams.date_to).trim()
				: undefined;
			const eventType = safeParams.event_type
				? String(safeParams.event_type).trim()
				: undefined;
			const tier1Only = safeParams.tier1_only !== false; // default true

			try {
				const events = await client.feedEvents({
					lastNDays,
					eventType,
					tier1Only,
					limit: 100,
					dateFrom,
					dateTo,
				});

				if (events.length === 0) {
					const rangeLabel =
						lastNDays === 1
							? "today"
							: `the last ${lastNDays} day${lastNDays > 1 ? "s" : ""}`;
					return {
						content: [
							{
								type: "text",
								text: `No activity found for ${rangeLabel}. Nowledge Mem may not be running or no events have been recorded yet.`,
							},
						],
					};
				}

				const filtered = events;

				// Group by date (YYYY-MM-DD from created_at)
				const byDay = new Map();
				for (const event of filtered) {
					const raw = event.created_at || event.timestamp || "";
					const date = raw.slice(0, 10) || "unknown";
					if (!byDay.has(date)) byDay.set(date, []);
					byDay.get(date).push(event);
				}

				// Sort days newest first
				const sortedDays = [...byDay.entries()].sort(([a], [b]) =>
					b.localeCompare(a),
				);

				const lines = sortedDays.map(([date, evts]) => {
					const items = evts
						.slice(0, 20) // cap per day
						.map((e) => {
							const label = labelForType(e.event_type);
							const title =
								e.title || e.description || e.content?.slice(0, 80) || "";
							// Surface memoryId for events that create/relate to memories
							// so the agent can follow up with memory_get or nowledge_mem_connections
							const memoryIds = [
								...(e.related_memory_ids ?? []),
								...(e.memory_id ? [e.memory_id] : []),
							];
							const idHint =
								memoryIds.length > 0
									? ` (id: ${memoryIds[0]}${memoryIds.length > 1 ? ` +${memoryIds.length - 1}` : ""})`
									: "";
							return `  - [${label}] ${title}${idHint}`;
						})
						.join("\n");
					return `**${date}**\n${items}`;
				});

				const header = dateFrom
					? `Activity ${dateFrom}${dateTo && dateTo !== dateFrom ? ` → ${dateTo}` : ""}:`
					: lastNDays === 1
						? "Today's activity:"
						: `Activity over the last ${lastNDays} days:`;

				return {
					content: [
						{
							type: "text",
							text: [header, "", ...lines].join("\n"),
						},
					],
					details: {
						lastNDays,
						eventCount: filtered.length,
						dayCount: sortedDays.length,
					},
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`timeline failed: ${msg}`);
				return {
					content: [{ type: "text", text: `Failed to get timeline: ${msg}` }],
				};
			}
		},
	};
}
