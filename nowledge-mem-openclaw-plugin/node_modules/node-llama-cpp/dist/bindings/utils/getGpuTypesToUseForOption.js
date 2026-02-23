import process from "process";
import { buildGpuOptions } from "../types.js";
import { getPlatform } from "./getPlatform.js";
import { getBestComputeLayersAvailable } from "./getBestComputeLayersAvailable.js";
export async function getGpuTypesToUseForOption(gpu, { platform = getPlatform(), arch = process.arch } = {}) {
    const resolvedGpuOption = typeof gpu === "object"
        ? gpu.type
        : gpu;
    function withExcludedGpuTypesRemoved(gpuTypes) {
        const resolvedExcludeTypes = typeof gpu === "object"
            ? new Set(gpu.exclude ?? [])
            : new Set();
        return gpuTypes.filter((gpuType) => !resolvedExcludeTypes.has(gpuType));
    }
    const resolvedGpu = resolveValidGpuOptionForPlatform(resolvedGpuOption, {
        platform,
        arch
    });
    if (resolvedGpu === "auto") {
        if (arch === process.arch)
            return withExcludedGpuTypesRemoved(await getBestComputeLayersAvailable());
        return withExcludedGpuTypesRemoved([false]);
    }
    return withExcludedGpuTypesRemoved([resolvedGpu]);
}
export function resolveValidGpuOptionForPlatform(gpu, { platform, arch }) {
    if (gpu == null)
        return "auto";
    else if (platform === "mac") {
        if (arch !== "x64" && gpu === "cuda")
            return "auto";
    }
    else if (gpu === "metal")
        return "auto";
    if (buildGpuOptions.includes(gpu))
        return gpu;
    return "auto";
}
//# sourceMappingURL=getGpuTypesToUseForOption.js.map