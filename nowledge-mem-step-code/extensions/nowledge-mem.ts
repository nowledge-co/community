import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function nowledgeMemStepCode(step: ExtensionAPI) {
	process.env.NMEM_PLUGIN_SOURCE_APP = "step-code";
	process.env.NMEM_PLUGIN_HOST_LABEL = "Step Code";
	process.env.NMEM_PLUGIN_VERSION = "0.1.0";
	process.env.NMEM_PLUGIN_CAPTURE_EVENT = "agent_settled";

	const module = await import("nowledge-mem-pi/extensions/nowledge-mem.ts");
	return module.default(step);
}
