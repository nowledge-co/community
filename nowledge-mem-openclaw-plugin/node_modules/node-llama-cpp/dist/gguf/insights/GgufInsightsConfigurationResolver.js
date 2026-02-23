import { getDefaultContextSequences } from "../../evaluator/LlamaContext/LlamaContext.js";
import { InsufficientMemoryError } from "../../utils/InsufficientMemoryError.js";
import { resolveModelGpuLayersOption } from "./utils/resolveModelGpuLayersOption.js";
import { resolveContextContextSizeOption } from "./utils/resolveContextContextSizeOption.js";
import { scoreLevels } from "./utils/scoreLevels.js";
import { getRamUsageFromUnifiedVram } from "./utils/getRamUsageFromUnifiedVram.js";
export const defaultTrainContextSizeForEstimationPurposes = 4096;
const defaultContextSizeForUnfitContextSizeConfiguration = 2048;
export class GgufInsightsConfigurationResolver {
    /** @internal */ _ggufInsights;
    constructor(ggufInsights) {
        this._ggufInsights = ggufInsights;
    }
    get ggufInsights() {
        return this._ggufInsights;
    }
    /**
     * Resolve the best configuration for loading a model and creating a context using the current hardware.
     *
     * Specifying a `targetGpuLayers` and/or `targetContextSize` will ensure the resolved configuration matches those values,
     * but note it can lower the compatibility score if the hardware doesn't support it.
     *
     * Overriding hardware values it possible by configuring `hardwareOverrides`.
     * @param options
     * @param hardwareOverrides
     */
    async resolveAndScoreConfig({ targetGpuLayers, targetContextSize, embeddingContext = false, flashAttention = false, swaFullCache = false, useMmap = this._ggufInsights._llama.supportsMmap } = {}, { getVramState = (() => this._ggufInsights._llama._vramOrchestrator.getMemoryState()), getRamState = (async () => this._ggufInsights._llama._ramOrchestrator.getMemoryState()), getSwapState = (() => this._ggufInsights._llama._swapOrchestrator.getMemoryState()), llamaVramPaddingSize = this._ggufInsights._llama.vramPaddingSize, llamaGpu = this._ggufInsights._llama.gpu, llamaSupportsGpuOffloading = this._ggufInsights._llama.supportsGpuOffloading } = {}) {
        const compatibilityScore = await this.scoreModelConfigurationCompatibility({
            flashAttention,
            swaFullCache,
            contextSize: targetContextSize,
            embeddingContext,
            forceGpuLayers: targetGpuLayers,
            forceStrictContextSize: targetContextSize != null,
            useMmap
        }, {
            getVramState,
            getRamState,
            getSwapState,
            llamaVramPaddingSize,
            llamaGpu,
            llamaSupportsGpuOffloading
        });
        return compatibilityScore;
    }
    /**
     * Score the compatibility of the model configuration with the current GPU and VRAM state.
     * Assumes a model is loaded with the default `"auto"` configurations.
     * Scored based on the following criteria:
     * - The number of GPU layers that can be offloaded to the GPU (only if there's a GPU. If there's no GPU then by how small the model is)
     * - Whether all layers can be offloaded to the GPU (gives additional points)
     * - Whether the resolved context size is at least as large as the specified `contextSize`
     *
     * If the resolved context size is larger than the specified context size, for each multiplier of the specified `contextSize`
     * that the resolved context size is larger by, 1 bonus point is given in the `bonusScore`.
     *
     * `maximumFittedContextSizeMultiplier` is used to improve the proportionality of the bonus score between models.
     * Set this to any value higher than `<max compared model context size> / contextSize`.
     * Defaults to `100`.
     *
     * `maximumUnfitConfigurationResourceMultiplier` is used to improve the proportionality of the bonus score between unfit models.
     * Set this to any value higher than `<max compared model resource usage> / <total available resources>`.
     * Defaults to `100`.
     *
     * `contextSize` defaults to `4096` (if the model train context size is lower than this, the model train context size is used instead).
     */
    async scoreModelConfigurationCompatibility({ contextSize = Math.min(4096, this._ggufInsights.trainContextSize ?? 4096), embeddingContext = false, flashAttention = false, swaFullCache = false, maximumFittedContextSizeMultiplier = 100, maximumUnfitConfigurationResourceMultiplier = 100, forceStrictContextSize = false, forceGpuLayers, useMmap = this._ggufInsights._llama.supportsMmap } = {}, { getVramState = (() => this._ggufInsights._llama._vramOrchestrator.getMemoryState()), getRamState = (async () => this._ggufInsights._llama._ramOrchestrator.getMemoryState()), getSwapState = (() => this._ggufInsights._llama._swapOrchestrator.getMemoryState()), llamaVramPaddingSize = this._ggufInsights._llama.vramPaddingSize, llamaGpu = this._ggufInsights._llama.gpu, llamaSupportsGpuOffloading = this._ggufInsights._llama.supportsGpuOffloading } = {}) {
        const [vramState, ramState, swapState] = await Promise.all([
            getVramState(),
            getRamState(),
            getSwapState()
        ]);
        let resolvedGpuLayers = (forceGpuLayers == null || forceGpuLayers == "max")
            ? this.ggufInsights.totalLayers
            : forceGpuLayers;
        let gpuLayersFitMemory = false;
        try {
            resolvedGpuLayers = await this.resolveModelGpuLayers(forceGpuLayers != null
                ? forceGpuLayers
                : embeddingContext
                    ? {
                        fitContext: {
                            embeddingContext: true,
                            contextSize: forceStrictContextSize
                                ? contextSize
                                : undefined
                        }
                    }
                    : forceStrictContextSize != null
                        ? { fitContext: { contextSize } }
                        : "auto", {
                getVramState: async () => vramState,
                llamaVramPaddingSize,
                llamaGpu,
                llamaSupportsGpuOffloading,
                defaultContextFlashAttention: flashAttention,
                defaultContextSwaFullCache: swaFullCache,
                ignoreMemorySafetyChecks: forceGpuLayers != null,
                useMmap
            });
            gpuLayersFitMemory = true;
        }
        catch (err) {
            if (!(err instanceof InsufficientMemoryError))
                throw err;
        }
        const canUseGpu = llamaSupportsGpuOffloading && llamaGpu !== false;
        const estimatedModelResourceUsage = this._ggufInsights.estimateModelResourceRequirements({
            gpuLayers: resolvedGpuLayers,
            useMmap
        });
        let resolvedContextSize = forceStrictContextSize
            ? contextSize
            : Math.min(this.ggufInsights.trainContextSize ?? defaultContextSizeForUnfitContextSizeConfiguration, defaultContextSizeForUnfitContextSizeConfiguration);
        let contextFitsMemory = false;
        try {
            resolvedContextSize = await this.resolveContextContextSize("auto", {
                getVramState: async () => ({
                    total: vramState.total,
                    free: Math.max(0, vramState.free - estimatedModelResourceUsage.gpuVram),
                    unifiedSize: vramState.unifiedSize
                }),
                getRamState: async () => ({
                    total: ramState.total,
                    free: Math.max(0, ramState.free - estimatedModelResourceUsage.cpuRam +
                        (-getRamUsageFromUnifiedVram(estimatedModelResourceUsage.gpuVram, vramState)))
                }),
                getSwapState: async () => ({
                    total: swapState.total,
                    free: Math.max(0, swapState.free - Math.max(0, estimatedModelResourceUsage.cpuRam +
                        (-getRamUsageFromUnifiedVram(estimatedModelResourceUsage.gpuVram, vramState)) +
                        (-ramState.free)))
                }),
                llamaGpu,
                isEmbeddingContext: embeddingContext,
                modelGpuLayers: resolvedGpuLayers,
                modelTrainContextSize: this._ggufInsights.trainContextSize ?? defaultTrainContextSizeForEstimationPurposes,
                ignoreMemorySafetyChecks: forceStrictContextSize,
                flashAttention,
                swaFullCache
            });
            contextFitsMemory = true;
            if (forceStrictContextSize && resolvedContextSize < contextSize) {
                contextFitsMemory = false;
                resolvedContextSize = contextSize;
            }
            else if (forceStrictContextSize && resolvedContextSize > contextSize) {
                resolvedContextSize = contextSize;
            }
        }
        catch (err) {
            if (!(err instanceof InsufficientMemoryError))
                throw err;
        }
        const estimatedContextResourceUsage = this._ggufInsights.estimateContextResourceRequirements({
            contextSize: resolvedContextSize,
            isEmbeddingContext: embeddingContext,
            modelGpuLayers: resolvedGpuLayers,
            flashAttention,
            swaFullCache
        });
        const rankPoints = {
            gpuLayers: 60,
            allLayersAreOffloaded: 10,
            contextSize: 30,
            ramUsageFitsInRam: 10,
            cpuOnlySmallModelSize: 70, // also defined inside `scoreModelSizeForCpuOnlyUsage`
            bonusContextSize: 10
        };
        const gpuLayersPoints = rankPoints.gpuLayers * Math.min(1, resolvedGpuLayers / this._ggufInsights.totalLayers);
        const allLayersAreOffloadedPoints = rankPoints.allLayersAreOffloaded * (resolvedGpuLayers === this._ggufInsights.totalLayers ? 1 : 0);
        const contextSizePoints = contextFitsMemory
            ? rankPoints.contextSize * Math.min(1, resolvedContextSize / contextSize)
            : 0;
        const ramUsageFitsInRamPoints = rankPoints.ramUsageFitsInRam * (estimatedModelResourceUsage.cpuRam <= ramState.free
            ? 1
            : estimatedModelResourceUsage.cpuRam <= ramState.free + swapState.free
                ? 0.8
                : estimatedModelResourceUsage.cpuRam <= ramState.total
                    ? 0.5
                    : (0.5 - Math.min(0.5, 0.5 * ((estimatedModelResourceUsage.cpuRam - ramState.total) / ramState.total))));
        const bonusContextSizePoints = contextFitsMemory
            ? (10 * Math.min(1, (Math.max(0, resolvedContextSize - contextSize) / contextSize) / maximumFittedContextSizeMultiplier))
            : 0;
        let compatibilityScore = canUseGpu
            ? ((gpuLayersPoints + allLayersAreOffloadedPoints + contextSizePoints + ramUsageFitsInRamPoints) /
                (rankPoints.gpuLayers + rankPoints.allLayersAreOffloaded + rankPoints.contextSize + rankPoints.ramUsageFitsInRam))
            : ((contextSizePoints + ramUsageFitsInRamPoints + scoreModelSizeForCpuOnlyUsage(this._ggufInsights.modelSize)) /
                (rankPoints.contextSize + rankPoints.ramUsageFitsInRam + rankPoints.cpuOnlySmallModelSize));
        let bonusScore = bonusContextSizePoints / rankPoints.bonusContextSize;
        if (!gpuLayersFitMemory || !contextFitsMemory ||
            estimatedModelResourceUsage.gpuVram + estimatedContextResourceUsage.gpuVram > vramState.total ||
            estimatedModelResourceUsage.cpuRam + estimatedContextResourceUsage.cpuRam > ramState.total + swapState.total) {
            const totalVramRequirement = estimatedModelResourceUsage.gpuVram + estimatedContextResourceUsage.gpuVram;
            const totalRamRequirement = estimatedModelResourceUsage.cpuRam + estimatedContextResourceUsage.cpuRam;
            compatibilityScore = 0;
            bonusScore = ((1 - (totalVramRequirement / (vramState.total * maximumUnfitConfigurationResourceMultiplier))) +
                (1 - (totalRamRequirement / ((ramState.total + swapState.total) * maximumUnfitConfigurationResourceMultiplier)))) / 2;
        }
        return {
            compatibilityScore,
            bonusScore,
            totalScore: compatibilityScore + bonusScore,
            resolvedValues: {
                gpuLayers: resolvedGpuLayers,
                contextSize: resolvedContextSize,
                modelRamUsage: estimatedModelResourceUsage.cpuRam,
                contextRamUsage: estimatedContextResourceUsage.cpuRam,
                totalRamUsage: estimatedModelResourceUsage.cpuRam + estimatedContextResourceUsage.cpuRam,
                modelVramUsage: estimatedModelResourceUsage.gpuVram,
                contextVramUsage: estimatedContextResourceUsage.gpuVram,
                totalVramUsage: estimatedModelResourceUsage.gpuVram + estimatedContextResourceUsage.gpuVram
            }
        };
    }
    async resolveModelGpuLayers(gpuLayers, { ignoreMemorySafetyChecks = false, getVramState = (() => this._ggufInsights._llama._vramOrchestrator.getMemoryState()), llamaVramPaddingSize = this._ggufInsights._llama.vramPaddingSize, llamaGpu = this._ggufInsights._llama.gpu, llamaSupportsGpuOffloading = this._ggufInsights._llama.supportsGpuOffloading, defaultContextFlashAttention = false, defaultContextSwaFullCache = false, useMmap = this._ggufInsights._llama.supportsMmap } = {}) {
        return resolveModelGpuLayersOption(gpuLayers, {
            ggufInsights: this._ggufInsights,
            ignoreMemorySafetyChecks,
            getVramState,
            llamaVramPaddingSize,
            llamaGpu,
            llamaSupportsGpuOffloading,
            defaultContextFlashAttention,
            defaultContextSwaFullCache,
            useMmap
        });
    }
    /**
     * Resolve a context size option for the given options and constraints.
     *
     * If there's no context size that can fit the available resources, an `InsufficientMemoryError` is thrown.
     */
    async resolveContextContextSize(contextSize, { modelGpuLayers, batchSize, modelTrainContextSize, flashAttention = false, swaFullCache = false, getVramState = (() => this._ggufInsights._llama._vramOrchestrator.getMemoryState()), getRamState = (async () => this._ggufInsights._llama._ramOrchestrator.getMemoryState()), getSwapState = (() => this._ggufInsights._llama._swapOrchestrator.getMemoryState()), llamaGpu = this._ggufInsights._llama.gpu, ignoreMemorySafetyChecks = false, isEmbeddingContext = false, sequences = getDefaultContextSequences() }) {
        return await resolveContextContextSizeOption({
            contextSize,
            batchSize,
            sequences,
            modelFileInsights: this._ggufInsights,
            modelGpuLayers,
            modelTrainContextSize,
            flashAttention,
            swaFullCache,
            getVramState,
            getRamState,
            getSwapState,
            llamaGpu,
            ignoreMemorySafetyChecks,
            isEmbeddingContext
        });
    }
    /** @internal */
    static _create(ggufInsights) {
        return new GgufInsightsConfigurationResolver(ggufInsights);
    }
}
function scoreModelSizeForCpuOnlyUsage(modelSize) {
    const s1GB = Math.pow(1024, 3);
    return 70 - scoreLevels(modelSize, [{
            start: s1GB,
            end: s1GB * 2.5,
            points: 46
        }, {
            start: s1GB * 2.5,
            end: s1GB * 4,
            points: 17
        }, {
            start: s1GB * 4,
            points: 7
        }]);
}
//# sourceMappingURL=GgufInsightsConfigurationResolver.js.map