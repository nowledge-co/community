import { LlamaContextOptions } from "../../../evaluator/LlamaContext/types.js";
import { GgufInsights } from "../GgufInsights.js";
import { BuildGpu } from "../../../bindings/types.js";
export declare function resolveContextContextSizeOption({ contextSize, batchSize, sequences, modelFileInsights, modelGpuLayers, modelTrainContextSize, flashAttention, swaFullCache, getVramState, getRamState, getSwapState, ignoreMemorySafetyChecks, isEmbeddingContext, maxContextSizeSwapUse }: {
    contextSize?: LlamaContextOptions["contextSize"];
    batchSize?: LlamaContextOptions["batchSize"];
    sequences: number;
    modelFileInsights: GgufInsights;
    modelGpuLayers: number;
    modelTrainContextSize: number;
    flashAttention: boolean;
    swaFullCache: boolean;
    getVramState(): Promise<{
        total: number;
        free: number;
        unifiedSize: number;
    }>;
    getRamState(): Promise<{
        total: number;
        free: number;
    }>;
    getSwapState(): Promise<{
        total: number;
        free: number;
    }>;
    llamaGpu: BuildGpu;
    ignoreMemorySafetyChecks?: boolean;
    isEmbeddingContext?: boolean;
    maxContextSizeSwapUse?: number;
}): Promise<number>;
