/**
 * nowledge_mem_save — structured knowledge capture.
 *
 * Unlike a generic "store text" tool, this captures knowledge with:
 * - Type classification (8 unit types → typed nodes in the knowledge graph)
 * - Labels (arbitrary tags for recall and filtering)
 * - Temporal context (when the event happened, not just when it was saved)
 *
 * Reflects Nowledge Mem's v0.6 memory model where every memory is a
 * rich typed node — not a flat text blob.
 */

const VALID_UNIT_TYPES = new Set([
	"fact",
	"preference",
	"decision",
	"plan",
	"procedure",
	"learning",
	"context",
	"event",
]);

export function createSaveTool(client, logger) {
	return {
		name: "nowledge_mem_save",
		description:
			"Save a new insight, decision, or fact to the user's permanent knowledge graph. " +
			"Call this proactively — don't wait to be asked. If the conversation surfaces something worth keeping " +
			"(a technical choice made, a preference stated, something learned, a plan formed, a tool discovered), save it. " +
			"Specify unit_type to give the memory richer structure: " +
			"decision (a choice made), learning (an insight gained), preference (user taste), " +
			"fact (verified info), plan (future intent), procedure (how-to steps), event (something that happened). " +
			"Use labels for topics/projects. Use event_start for when the event HAPPENED (not when it's saved).",
		parameters: {
			type: "object",
			properties: {
				text: {
					type: "string",
					description:
						"The knowledge to save — be specific and self-contained. Write it as if explaining to your future self.",
				},
				title: {
					type: "string",
					description: "Short searchable title (50–60 chars ideal)",
				},
				unit_type: {
					type: "string",
					enum: [...VALID_UNIT_TYPES],
					description:
						"Type: fact (verified info) | preference (user taste) | decision (choice made) | " +
						"plan (future intent) | procedure (how-to) | learning (insight gained) | " +
						"context (background info) | event (something that happened)",
				},
				importance: {
					type: "number",
					description:
						"0.8–1.0: critical decisions/breakthroughs. 0.5–0.7: useful insights. 0.3–0.4: minor notes.",
				},
				labels: {
					type: "array",
					items: { type: "string" },
					description:
						"Topic or project labels for this memory (e.g. [\"python\", \"infra\"]). Used in search filtering.",
				},
				event_start: {
					type: "string",
					description:
						"When the event/fact HAPPENED — not when you're saving it. " +
						"Format: YYYY, YYYY-MM, or YYYY-MM-DD. Example: '2024-03' for March 2024.",
				},
				event_end: {
					type: "string",
					description:
						"End of the event period (for ranges). Same format as event_start.",
				},
				temporal_context: {
					type: "string",
					enum: ["past", "present", "future", "timeless"],
					description:
						"Temporal framing: past (already happened), present (ongoing), future (planned), timeless (always true).",
				},
			},
			required: ["text"],
		},
		async execute(_toolCallId, params) {
			const safeParams = params && typeof params === "object" ? params : {};
			const text = String(safeParams.text ?? "").trim();
			const title = safeParams.title ? String(safeParams.title).trim() : undefined;
			const unitType =
				typeof safeParams.unit_type === "string" &&
				VALID_UNIT_TYPES.has(safeParams.unit_type)
					? safeParams.unit_type
					: undefined;
			const hasImportance =
				safeParams.importance !== undefined && safeParams.importance !== null;
			const importance = hasImportance
				? Math.min(1, Math.max(0, Number(safeParams.importance)))
				: undefined;
			const labels = Array.isArray(safeParams.labels)
				? safeParams.labels
						.map((l) => String(l).trim())
						.filter((l) => l.length > 0)
				: [];
			const eventStart = safeParams.event_start
				? String(safeParams.event_start).trim()
				: undefined;
			const eventEnd = safeParams.event_end
				? String(safeParams.event_end).trim()
				: undefined;
			const temporalContext =
				typeof safeParams.temporal_context === "string" &&
				["past", "present", "future", "timeless"].includes(
					safeParams.temporal_context,
				)
					? safeParams.temporal_context
					: undefined;

			if (!text) {
				return {
					content: [{ type: "text", text: "Cannot save empty memory." }],
				};
			}

			try {
				const args = ["--json", "m", "add", text];
				if (title) args.push("-t", title);
				if (importance !== undefined && Number.isFinite(importance)) {
					args.push("-i", String(importance));
				}
				if (unitType) args.push("--unit-type", unitType);
				for (const label of labels) args.push("-l", label);
				if (eventStart) args.push("--event-start", eventStart);
				if (eventEnd) args.push("--event-end", eventEnd);
				if (temporalContext) args.push("--when", temporalContext);

				const data = client.execJson(args);
				const id = String(
					data.id ?? data.memory?.id ?? data.memory_id ?? "created",
				);

				// Build human-readable confirmation
				const typeLabel = unitType ? ` [${unitType}]` : "";
				const labelStr =
					labels.length > 0 ? ` · labels: ${labels.join(", ")}` : "";
				const timeStr = eventStart
					? ` · event: ${eventStart}${eventEnd ? `→${eventEnd}` : ""}`
					: "";

				logger.info(`save: stored memory ${id}${typeLabel}`);

				return {
					content: [
						{
							type: "text",
							text: `Saved${title ? `: ${title}` : ""}${typeLabel} (id: ${id})${labelStr}${timeStr}`,
						},
					],
					details: {
						id,
						title,
						unitType: data.unit_type || unitType,
						importance,
						labels: data.labels || labels,
						eventStart,
						eventEnd,
						temporalContext,
					},
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`save failed: ${msg}`);
				return {
					content: [{ type: "text", text: `Failed to save: ${msg}` }],
				};
			}
		},
	};
}
