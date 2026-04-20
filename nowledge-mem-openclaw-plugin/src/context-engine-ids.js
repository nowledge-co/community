export const NOWLEDGE_MEM_CONTEXT_ENGINE_ID = "nowledge-mem";
export const NOWLEDGE_MEM_CONTEXT_ENGINE_COMPAT_ALIAS =
	"openclaw-nowledge-mem";

export const NOWLEDGE_MEM_CONTEXT_ENGINE_IDS = [
	NOWLEDGE_MEM_CONTEXT_ENGINE_ID,
	NOWLEDGE_MEM_CONTEXT_ENGINE_COMPAT_ALIAS,
];

export function isNowledgeMemContextEngineSlot(value) {
	return (
		typeof value === "string" &&
		NOWLEDGE_MEM_CONTEXT_ENGINE_IDS.includes(value.trim())
	);
}
