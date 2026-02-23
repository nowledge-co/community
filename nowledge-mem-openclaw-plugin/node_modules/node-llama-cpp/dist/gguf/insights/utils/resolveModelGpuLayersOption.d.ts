import { LlamaModelOptions } from "../../../evaluator/LlamaModel/LlamaModel.js";
import { BuildGpu } from "../../../bindings/types.js";
import type { GgufInsights } from "../GgufInsights.js";
export declare function resolveModelGpuLayersOption(gpuLayers: LlamaModelOptions["gpuLayers"], { ggufInsights, ignoreMemorySafetyChecks, getVramState, llamaVramPaddingSize, llamaGpu, llamaSupportsGpuOffloading, defaultContextFlashAttention, defaultContextSwaFullCache, useMmap }: {
    ggufInsights: GgufInsights;
    ignoreMemorySafetyChecks?: boolean;
    getVramState(): Promise<{
        total: number;
        free: number;
    }>;
    llamaVramPaddingSize: number;
    llamaGpu: BuildGpu;
    llamaSupportsGpuOffloading: boolean;
    defaultContextFlashAttention: boolean;
    defaultContextSwaFullCache: boolean;
    useMmap?: boolean;
}): Promise<number>;
