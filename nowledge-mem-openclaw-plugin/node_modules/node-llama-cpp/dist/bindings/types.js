export const buildGpuOptions = ["metal", "cuda", "vulkan", false];
export const nodeLlamaCppGpuOptions = [
    "auto",
    ...buildGpuOptions
];
export const nodeLlamaCppGpuOffStringOptions = ["false", "off", "none", "disable", "disabled"];
export const llamaNumaOptions = ["distribute", "isolate", "numactl", "mirror", false];
export function parseNodeLlamaCppGpuOption(option) {
    function optionIsGpuOff(opt) {
        return nodeLlamaCppGpuOffStringOptions.includes(opt);
    }
    if (optionIsGpuOff(option))
        return false;
    else if (option === "auto")
        return "auto";
    if (buildGpuOptions.includes(option))
        return option;
    return "auto";
}
export function parseNumaOption(option) {
    function optionIsGpuOff(opt) {
        return nodeLlamaCppGpuOffStringOptions.includes(opt);
    }
    if (optionIsGpuOff(option))
        return false;
    if (llamaNumaOptions.includes(option))
        return option;
    return false;
}
export function convertBuildOptionsJSONToBuildOptions(buildOptionsJSON) {
    return {
        ...buildOptionsJSON,
        customCmakeOptions: new Map(Object.entries(buildOptionsJSON.customCmakeOptions))
    };
}
export function convertBuildOptionsToBuildOptionsJSON(buildOptions) {
    return {
        ...buildOptions,
        customCmakeOptions: Object.fromEntries(buildOptions.customCmakeOptions)
    };
}
export var LlamaLogLevel;
(function (LlamaLogLevel) {
    LlamaLogLevel["disabled"] = "disabled";
    LlamaLogLevel["fatal"] = "fatal";
    LlamaLogLevel["error"] = "error";
    LlamaLogLevel["warn"] = "warn";
    LlamaLogLevel["info"] = "info";
    LlamaLogLevel["log"] = "log";
    LlamaLogLevel["debug"] = "debug";
})(LlamaLogLevel || (LlamaLogLevel = {}));
export const LlamaLogLevelValues = Object.freeze([
    LlamaLogLevel.disabled,
    LlamaLogLevel.fatal,
    LlamaLogLevel.error,
    LlamaLogLevel.warn,
    LlamaLogLevel.info,
    LlamaLogLevel.log,
    LlamaLogLevel.debug
]);
export var LlamaVocabularyType;
(function (LlamaVocabularyType) {
    LlamaVocabularyType["none"] = "none";
    LlamaVocabularyType["spm"] = "spm";
    LlamaVocabularyType["bpe"] = "bpe";
    LlamaVocabularyType["wpm"] = "wpm";
    LlamaVocabularyType["ugm"] = "ugm";
    LlamaVocabularyType["rwkv"] = "rwkv";
    LlamaVocabularyType["plamo2"] = "plamo2";
})(LlamaVocabularyType || (LlamaVocabularyType = {}));
export const LlamaVocabularyTypeValues = Object.freeze([
    LlamaVocabularyType.none,
    LlamaVocabularyType.spm,
    LlamaVocabularyType.bpe,
    LlamaVocabularyType.wpm,
    LlamaVocabularyType.ugm,
    LlamaVocabularyType.rwkv,
    LlamaVocabularyType.plamo2
]);
/**
 * Check if a log level is higher than another log level
 * @example
 * ```ts
 * LlamaLogLevelGreaterThan(LlamaLogLevel.error, LlamaLogLevel.info); // true
 * ```
 */
export function LlamaLogLevelGreaterThan(a, b) {
    return LlamaLogLevelValues.indexOf(a) < LlamaLogLevelValues.indexOf(b);
}
/**
 * Check if a log level is higher than or equal to another log level
 * @example
 * ```ts
 * LlamaLogLevelGreaterThanOrEqual(LlamaLogLevel.error, LlamaLogLevel.info); // true
 * LlamaLogLevelGreaterThanOrEqual(LlamaLogLevel.error, LlamaLogLevel.error); // true
 * ```
 */
export function LlamaLogLevelGreaterThanOrEqual(a, b) {
    return LlamaLogLevelValues.indexOf(a) <= LlamaLogLevelValues.indexOf(b);
}
export var LlamaLocks;
(function (LlamaLocks) {
    LlamaLocks["loadToMemory"] = "loadToMemory";
})(LlamaLocks || (LlamaLocks = {}));
//# sourceMappingURL=types.js.map