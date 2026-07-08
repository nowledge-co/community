import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default async function nowledgeMemOmp(omp: ExtensionAPI) {
	process.env.NMEM_PLUGIN_SOURCE_APP = "omp";
	process.env.NMEM_PLUGIN_HOST_LABEL = "OMP";
	process.env.NMEM_PLUGIN_VERSION = "0.1.0";

	const module = await import("nowledge-mem-pi/extensions/nowledge-mem.ts");
	return module.default(omp as never);
}
