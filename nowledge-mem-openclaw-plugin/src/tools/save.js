/**
 * nowledge_mem_save — structured knowledge capture.
 *
 * Unlike a generic "store text" tool, this captures knowledge with
 * type classification (fact, preference, decision, plan, procedure,
 * learning, context, event) — reflecting Nowledge Mem's v0.6 memory
 * model where memories are typed nodes in a knowledge graph.
 */

const VALID_UNIT_TYPES = [
	"fact",
	"preference",
	"decision",
	"plan",
	"procedure",
	"learning",
	"context",
	"event",
];

export function createSaveTool(client, logger) {
	return {
		name: "nowledge_mem_save",
		description:
			"Save a new insight, decision, or fact to the user's permanent knowledge graph. " +
			"Call this proactively — don't wait to be asked. If the conversation surfaces something worth keeping " +
			"(a technical choice made, a preference stated, something learned, a plan formed, a tool discovered), save it. " +
			"Specify unit_type to give the memory richer structure: " +
			"decision (a choice made), learning (an insight gained), preference (user taste), " +
			"fact (verified info), plan (future intent), procedure (how-to steps), event (something that happened).",
		parameters: {
			type: "object",
			properties: {
				text: {
					type: "string",
					description: "The knowledge to save — be specific and self-contained",
				},
				title: {
					type: "string",
					description: "Short searchable title (50-60 chars)",
				},
				unit_type: {
					type: "string",
					enum: VALID_UNIT_TYPES,
					description:
						"Type of knowledge: fact (verified info), preference (user taste), decision (choice made), plan (future intent), procedure (how-to), learning (insight gained), context (background info), event (something that happened)",
				},
				importance: {
					type: "number",
					description:
						"0.8-1.0: critical decisions/breakthroughs, 0.5-0.7: useful insights, 0.3-0.4: minor notes",
				},
			},
			required: ["text"],
		},
		async execute(_toolCallId, params) {
			const safeParams = params && typeof params === "object" ? params : {};
			const text = String(safeParams.text ?? "").trim();
			const title = safeParams.title ? String(safeParams.title) : undefined;
			const unitType =
				typeof safeParams.unit_type === "string" &&
				VALID_UNIT_TYPES.includes(safeParams.unit_type)
					? safeParams.unit_type
					: undefined;
			const hasImportance =
				safeParams.importance !== undefined && safeParams.importance !== null;
			const importance = hasImportance
				? Number(safeParams.importance)
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
				if (unitType) {
					args.push("--unit-type", unitType);
				}

				let data;
				try {
					data = client.execJson(args);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					// If --unit-type isn't supported by this CLI version, retry without it
					if (
						unitType &&
						(msg.includes("unrecognized arguments") ||
							msg.includes("invalid choice"))
					) {
						logger.warn(
							"save: --unit-type not supported by CLI, retrying without it",
						);
						const fallbackArgs = args.filter(
							(a, i, arr) =>
								a !== "--unit-type" &&
								(i === 0 || arr[i - 1] !== "--unit-type"),
						);
						data = client.execJson(fallbackArgs);
					} else {
						throw err;
					}
				}

				const id = String(
					data.id ?? data.memory?.id ?? data.memory_id ?? "created",
				);
				const typeLabel = unitType ? ` [${unitType}]` : "";
				logger.info(`save: stored memory ${id}${typeLabel}`);

				return {
					content: [
						{
							type: "text",
							text: `Saved${title ? `: ${title}` : ""}${typeLabel} (id: ${id})`,
						},
					],
					details: { id, title, unitType, importance },
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
