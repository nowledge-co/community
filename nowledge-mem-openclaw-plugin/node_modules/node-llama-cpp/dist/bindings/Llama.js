import os from "os";
import path from "path";
import chalk from "chalk";
import { DisposedError, EventRelay, withLock } from "lifecycle-utils";
import { getConsoleLogPrefix } from "../utils/getConsoleLogPrefix.js";
import { LlamaModel } from "../evaluator/LlamaModel/LlamaModel.js";
import { DisposeGuard } from "../utils/DisposeGuard.js";
import { LlamaJsonSchemaGrammar } from "../evaluator/LlamaJsonSchemaGrammar.js";
import { LlamaGrammar } from "../evaluator/LlamaGrammar.js";
import { ThreadsSplitter } from "../utils/ThreadsSplitter.js";
import { getLlamaClasses } from "../utils/getLlamaClasses.js";
import { LlamaLocks, LlamaLogLevel, LlamaLogLevelGreaterThan, LlamaLogLevelGreaterThanOrEqual } from "./types.js";
import { MemoryOrchestrator } from "./utils/MemoryOrchestrator.js";
export const LlamaLogLevelToAddonLogLevel = new Map([
    [LlamaLogLevel.disabled, 0],
    [LlamaLogLevel.fatal, 1],
    [LlamaLogLevel.error, 2],
    [LlamaLogLevel.warn, 3],
    [LlamaLogLevel.info, 4],
    [LlamaLogLevel.log, 5],
    [LlamaLogLevel.debug, 6]
]);
const addonLogLevelToLlamaLogLevel = new Map([...LlamaLogLevelToAddonLogLevel.entries()].map(([key, value]) => [value, key]));
const defaultLogLevel = 5;
const defaultCPUMinThreadSplitterThreads = 4;
export class Llama {
    /** @internal */ _bindings;
    /** @internal */ _backendDisposeGuard = new DisposeGuard();
    /** @internal */ _memoryLock = {};
    /** @internal */ _consts;
    /** @internal */ _vramOrchestrator;
    /** @internal */ _vramPadding;
    /** @internal */ _ramOrchestrator;
    /** @internal */ _ramPadding;
    /** @internal */ _swapOrchestrator;
    /** @internal */ _debug;
    /** @internal */ _threadsSplitter;
    /** @internal */ _hadErrorLogs = false;
    /** @internal */ _gpu;
    /** @internal */ _numa;
    /** @internal */ _buildType;
    /** @internal */ _cmakeOptions;
    /** @internal */ _supportsGpuOffloading;
    /** @internal */ _supportsMmap;
    /** @internal */ _gpuSupportsMmap;
    /** @internal */ _supportsMlock;
    /** @internal */ _mathCores;
    /** @internal */ _llamaCppRelease;
    /** @internal */ _logger;
    /** @internal */ _logLevel;
    /** @internal */ _pendingLog = null;
    /** @internal */ _pendingLogLevel = null;
    /** @internal */ _logDispatchQueuedMicrotasks = 0;
    /** @internal */ _previousLog = null;
    /** @internal */ _previousLogLevel = null;
    /** @internal */ _nextLogNeedNewLine = false;
    /** @internal */ _disposed = false;
    _classes;
    onDispose = new EventRelay();
    constructor({ bindings, bindingPath, extBackendsPath, logLevel, logger, buildType, cmakeOptions, llamaCppRelease, debug, numa, buildGpu, maxThreads, vramOrchestrator, vramPadding, ramOrchestrator, ramPadding, swapOrchestrator, skipLlamaInit }) {
        this._dispatchPendingLogMicrotask = this._dispatchPendingLogMicrotask.bind(this);
        this._onAddonLog = this._onAddonLog.bind(this);
        this._bindings = bindings;
        this._debug = debug;
        this._numa = numa ?? false;
        this._logLevel = this._debug
            ? LlamaLogLevel.debug
            : (logLevel ?? LlamaLogLevel.debug);
        const previouslyLoaded = bindings.markLoaded();
        if (!this._debug && (!skipLlamaInit || !previouslyLoaded)) {
            this._bindings.setLogger(this._onAddonLog);
            this._bindings.setLoggerLogLevel(LlamaLogLevelToAddonLogLevel.get(this._logLevel) ?? defaultLogLevel);
        }
        bindings.loadBackends();
        let loadedGpu = bindings.getGpuType();
        if (loadedGpu == null || (loadedGpu === false && buildGpu !== false)) {
            const backendsPath = path.dirname(bindingPath);
            const fallbackBackendsDir = path.join(extBackendsPath ?? backendsPath, "fallback");
            bindings.loadBackends(backendsPath);
            loadedGpu = bindings.getGpuType();
            if (loadedGpu == null || (loadedGpu === false && buildGpu !== false))
                bindings.loadBackends(fallbackBackendsDir);
        }
        bindings.ensureGpuDeviceIsSupported();
        if (this._numa !== false)
            bindings.setNuma(numa);
        this._gpu = bindings.getGpuType() ?? false;
        this._supportsGpuOffloading = bindings.getSupportsGpuOffloading();
        this._supportsMmap = bindings.getSupportsMmap();
        this._gpuSupportsMmap = bindings.getGpuSupportsMmap();
        this._supportsMlock = bindings.getSupportsMlock();
        this._mathCores = Math.floor(bindings.getMathCores());
        this._consts = bindings.getConsts();
        this._vramOrchestrator = vramOrchestrator;
        this._vramPadding = vramPadding;
        this._ramOrchestrator = ramOrchestrator;
        this._ramPadding = ramPadding;
        this._swapOrchestrator = swapOrchestrator;
        this._threadsSplitter = new ThreadsSplitter(maxThreads ?? (this._gpu === false
            ? Math.max(defaultCPUMinThreadSplitterThreads, this._mathCores)
            : 0));
        this._logger = logger;
        this._buildType = buildType;
        this._cmakeOptions = Object.freeze({ ...cmakeOptions });
        this._llamaCppRelease = Object.freeze({
            repo: llamaCppRelease.repo,
            release: llamaCppRelease.release
        });
        this._onExit = this._onExit.bind(this);
        process.on("exit", this._onExit);
    }
    async dispose() {
        if (this._disposed)
            return;
        this._disposed = true;
        this.onDispose.dispatchEvent();
        await this._backendDisposeGuard.acquireDisposeLock();
        await this._bindings.dispose();
    }
    /** @hidden */
    async [Symbol.asyncDispose]() {
        await this.dispose();
    }
    get disposed() {
        return this._disposed;
    }
    get classes() {
        if (this._classes == null)
            this._classes = getLlamaClasses();
        return this._classes;
    }
    get gpu() {
        return this._gpu;
    }
    get supportsGpuOffloading() {
        return this._supportsGpuOffloading;
    }
    get supportsMmap() {
        return this._supportsMmap;
    }
    get gpuSupportsMmap() {
        return this._gpuSupportsMmap;
    }
    get supportsMlock() {
        return this._supportsMlock;
    }
    /** The number of CPU cores that are useful for math */
    get cpuMathCores() {
        return this._mathCores;
    }
    /**
     * The maximum number of threads that can be used by the Llama instance.
     *
     * If set to `0`, the Llama instance will have no limit on the number of threads.
     *
     * See the `maxThreads` option of `getLlama` for more information.
     */
    get maxThreads() {
        return this._threadsSplitter.maxThreads;
    }
    set maxThreads(value) {
        this._threadsSplitter.maxThreads = Math.floor(Math.max(0, value));
    }
    /**
     * See the `numa` option of `getLlama` for more information
     */
    get numa() {
        return this._numa;
    }
    get logLevel() {
        return this._logLevel;
    }
    set logLevel(value) {
        this._ensureNotDisposed();
        if (value === this._logLevel || this._debug)
            return;
        this._bindings.setLoggerLogLevel(LlamaLogLevelToAddonLogLevel.get(value) ?? defaultLogLevel);
        this._logLevel = value;
    }
    get logger() {
        return this._logger;
    }
    set logger(value) {
        this._logger = value;
        if (value !== Llama.defaultConsoleLogger)
            this._nextLogNeedNewLine = false;
    }
    get buildType() {
        return this._buildType;
    }
    get cmakeOptions() {
        return this._cmakeOptions;
    }
    get llamaCppRelease() {
        return this._llamaCppRelease;
    }
    get systemInfo() {
        this._ensureNotDisposed();
        return this._bindings.systemInfo();
    }
    /**
     * VRAM padding used for memory size calculations, as these calculations are not always accurate.
     * This is set by default to ensure stability, but can be configured when you call `getLlama`.
     *
     * See `vramPadding` on `getLlama` for more information.
     */
    get vramPaddingSize() {
        return this._vramPadding.size;
    }
    /**
     * The total amount of VRAM that is currently being used.
     *
     * `unifiedSize` represents the amount of VRAM that is shared between the CPU and GPU.
     * On SoC devices, this is usually the same as `total`.
     */
    async getVramState() {
        this._ensureNotDisposed();
        const { total, used, unifiedSize } = this._bindings.getGpuVramInfo();
        return {
            total,
            used,
            free: Math.max(0, total - used),
            unifiedSize
        };
    }
    /**
     * Get the state of the swap memory.
     *
     * **`maxSize`** - The maximum size of the swap memory that the system can allocate.
     * If the swap size is dynamic (like on macOS), this will be `Infinity`.
     *
     * **`allocated`** - The total size allocated by the system for swap memory.
     *
     * **`used`** - The amount of swap memory that is currently being used from the `allocated` size.
     *
     * On Windows, this will return the info for the page file.
     */
    async getSwapState() {
        this._ensureNotDisposed();
        const { total, maxSize, free } = this._bindings.getSwapInfo();
        return {
            maxSize: maxSize === -1
                ? Infinity
                : maxSize,
            allocated: total,
            used: total - free
        };
    }
    async getGpuDeviceNames() {
        this._ensureNotDisposed();
        const { deviceNames } = this._bindings.getGpuDeviceInfo();
        return deviceNames;
    }
    async loadModel(options) {
        this._ensureNotDisposed();
        return await withLock([this._memoryLock, LlamaLocks.loadToMemory], options.loadSignal, async () => {
            this._ensureNotDisposed();
            const preventDisposalHandle = this._backendDisposeGuard.createPreventDisposalHandle();
            try {
                return await LlamaModel._create(options, { _llama: this });
            }
            finally {
                preventDisposalHandle.dispose();
            }
        });
    }
    /* eslint-disable @stylistic/max-len */
    /**
     * @see [Using a JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#json-schema) tutorial
     * @see [Reducing Hallucinations When Using JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#reducing-json-schema-hallucinations) tutorial
     */
    async createGrammarForJsonSchema(schema) {
        return new LlamaJsonSchemaGrammar(this, schema);
    }
    /* eslint-enable @stylistic/max-len */
    async getGrammarFor(type) {
        return await LlamaGrammar.getFor(this, type);
    }
    /**
     * @see [Using Grammar](https://node-llama-cpp.withcat.ai/guide/grammar) tutorial
     */
    async createGrammar(options) {
        return new LlamaGrammar(this, options);
    }
    /** @internal */
    async _init() {
        await this._bindings.init();
    }
    /**
     * Log messages related to the Llama instance
     * @internal
     */
    _log(level, message) {
        this._onAddonLog(LlamaLogLevelToAddonLogLevel.get(level) ?? defaultLogLevel, message + "\n");
    }
    /** @internal */
    _onAddonLog(level, message) {
        const llamaLogLevel = addonLogLevelToLlamaLogLevel.get(level) ?? LlamaLogLevel.fatal;
        if (this._pendingLog != null && this._pendingLogLevel != null && this._pendingLogLevel != llamaLogLevel) {
            this._callLogger(this._pendingLogLevel, this._pendingLog);
            this._pendingLog = null;
        }
        const sourceMessage = (this._pendingLog ?? "") + message;
        const lastNewLineIndex = sourceMessage.lastIndexOf("\n");
        const currentLog = lastNewLineIndex < 0
            ? sourceMessage
            : sourceMessage.slice(0, lastNewLineIndex);
        const nextLog = lastNewLineIndex < 0
            ? ""
            : sourceMessage.slice(lastNewLineIndex + 1);
        if (currentLog !== "")
            this._callLogger(llamaLogLevel, currentLog);
        if (nextLog !== "") {
            this._pendingLog = nextLog;
            this._pendingLogLevel = llamaLogLevel;
            queueMicrotask(this._dispatchPendingLogMicrotask);
            this._logDispatchQueuedMicrotasks++;
        }
        else
            this._pendingLog = null;
    }
    /** @internal */
    _dispatchPendingLogMicrotask() {
        this._logDispatchQueuedMicrotasks--;
        if (this._logDispatchQueuedMicrotasks !== 0)
            return;
        if (this._pendingLog != null && this._pendingLogLevel != null) {
            this._callLogger(this._pendingLogLevel, this._pendingLog);
            this._pendingLog = null;
        }
    }
    /** @internal */
    _callLogger(level, message) {
        // llama.cpp uses dots to indicate progress, so we don't want to print them as different lines,
        // and instead, append to the same log line
        if (logMessageIsOnlyDots(message) && this._logger === Llama.defaultConsoleLogger) {
            if (logMessageIsOnlyDots(this._previousLog) && level === this._previousLogLevel) {
                process.stdout.write(message);
            }
            else {
                this._nextLogNeedNewLine = true;
                process.stdout.write(prefixAndColorMessage(message, getColorForLogLevel(level)));
            }
        }
        else {
            if (this._nextLogNeedNewLine) {
                process.stdout.write("\n");
                this._nextLogNeedNewLine = false;
            }
            try {
                const transformedLogLevel = getTransformedLogLevel(level, message, this.gpu);
                if (LlamaLogLevelGreaterThanOrEqual(transformedLogLevel, this._logLevel))
                    this._logger(transformedLogLevel, message);
            }
            catch (err) {
                // the native addon code calls this function, so there's no use to throw an error here
            }
        }
        this._previousLog = message;
        this._previousLogLevel = level;
        if (!this._hadErrorLogs && LlamaLogLevelGreaterThan(level, LlamaLogLevel.error))
            this._hadErrorLogs = true;
    }
    /** @internal */
    _onExit() {
        if (this._pendingLog != null && this._pendingLogLevel != null) {
            this._callLogger(this._pendingLogLevel, this._pendingLog);
            this._pendingLog = null;
        }
    }
    /** @internal */
    _ensureNotDisposed() {
        if (this._disposed)
            throw new DisposedError();
    }
    /** @internal */
    static async _create({ bindings, bindingPath, extBackendsPath, buildType, buildMetadata, logLevel, logger, vramPadding, ramPadding, maxThreads, skipLlamaInit = false, debug, numa }) {
        const vramOrchestrator = new MemoryOrchestrator(() => {
            const { total, used, unifiedSize } = bindings.getGpuVramInfo();
            return {
                total,
                free: Math.max(0, total - used),
                unifiedSize
            };
        });
        const ramOrchestrator = new MemoryOrchestrator(() => {
            const used = process.memoryUsage().rss;
            const total = os.totalmem();
            return {
                total,
                free: Math.max(0, total - used),
                unifiedSize: total
            };
        });
        const swapOrchestrator = new MemoryOrchestrator(() => {
            const { total, maxSize, free } = bindings.getSwapInfo();
            const used = total - free;
            if (maxSize === -1)
                return {
                    total: Infinity,
                    free: Infinity,
                    unifiedSize: Infinity
                };
            return {
                total: maxSize,
                free: maxSize - used,
                unifiedSize: maxSize
            };
        });
        let resolvedRamPadding;
        if (ramPadding instanceof Function)
            resolvedRamPadding = ramOrchestrator.reserveMemory(ramPadding((await ramOrchestrator.getMemoryState()).total));
        else
            resolvedRamPadding = ramOrchestrator.reserveMemory(ramPadding);
        const llama = new Llama({
            bindings,
            bindingPath,
            extBackendsPath,
            buildType,
            cmakeOptions: buildMetadata.buildOptions.customCmakeOptions,
            llamaCppRelease: {
                repo: buildMetadata.buildOptions.llamaCpp.repo,
                release: buildMetadata.buildOptions.llamaCpp.release
            },
            logLevel,
            logger,
            debug,
            numa,
            buildGpu: buildMetadata.buildOptions.gpu,
            vramOrchestrator,
            maxThreads,
            vramPadding: vramOrchestrator.reserveMemory(0),
            ramOrchestrator,
            ramPadding: resolvedRamPadding,
            swapOrchestrator,
            skipLlamaInit
        });
        if (llama.gpu === false || vramPadding === 0) {
            // do nothing since `llama._vramPadding` is already set to 0
        }
        else if (vramPadding instanceof Function) {
            const currentVramPadding = llama._vramPadding;
            llama._vramPadding = vramOrchestrator.reserveMemory(vramPadding((await vramOrchestrator.getMemoryState()).total));
            currentVramPadding.dispose();
        }
        else {
            const currentVramPadding = llama._vramPadding;
            llama._vramPadding = vramOrchestrator.reserveMemory(vramPadding);
            currentVramPadding.dispose();
        }
        if (!skipLlamaInit)
            await llama._init();
        return llama;
    }
    static defaultConsoleLogger(level, message) {
        switch (level) {
            case LlamaLogLevel.disabled:
                break;
            case LlamaLogLevel.fatal:
                // we don't use console.error here because it prints the stack trace
                console.warn(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            case LlamaLogLevel.error:
                // we don't use console.error here because it prints the stack trace
                console.warn(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            case LlamaLogLevel.warn:
                console.warn(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            case LlamaLogLevel.info:
                console.info(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            case LlamaLogLevel.log:
                console.info(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            case LlamaLogLevel.debug:
                console.debug(prefixAndColorMessage(message, getColorForLogLevel(level)));
                break;
            default:
                void level;
                console.warn(getConsoleLogPrefix() + getColorForLogLevel(LlamaLogLevel.warn)(`Unknown log level: ${level}`));
                console.log(prefixAndColorMessage(message, getColorForLogLevel(level)));
        }
    }
}
function getColorForLogLevel(level) {
    switch (level) {
        case LlamaLogLevel.disabled: return chalk.whiteBright;
        case LlamaLogLevel.fatal: return chalk.redBright;
        case LlamaLogLevel.error: return chalk.red;
        case LlamaLogLevel.warn: return chalk.yellow;
        case LlamaLogLevel.info: return chalk.whiteBright;
        case LlamaLogLevel.log: return chalk.white;
        case LlamaLogLevel.debug: return chalk.gray;
        default:
            void level;
            return chalk.whiteBright;
    }
}
function prefixAndColorMessage(message, color) {
    return getConsoleLogPrefix() + (message
        .split("\n")
        .map((line) => color(line))
        .join("\n" + getConsoleLogPrefix()));
}
function logMessageIsOnlyDots(message) {
    if (message == null)
        return false;
    for (let i = 0; i < message.length; i++) {
        if (message[i] !== ".")
            return false;
    }
    return true;
}
function getTransformedLogLevel(level, message, gpu) {
    if (level === LlamaLogLevel.warn && message.endsWith("the full capacity of the model will not be utilized"))
        return LlamaLogLevel.info;
    else if (level === LlamaLogLevel.warn && message.startsWith("ggml_metal_init: skipping kernel_") && message.endsWith("(not supported)"))
        return LlamaLogLevel.log;
    else if (level === LlamaLogLevel.warn && message.startsWith("ggml_cuda_init: GGML_CUDA_FORCE_") && message.endsWith(" no"))
        return LlamaLogLevel.log;
    else if (level === LlamaLogLevel.info && message.startsWith("load_backend: loaded "))
        return LlamaLogLevel.log;
    else if (level === LlamaLogLevel.warn && message.startsWith("make_cpu_buft_list: disabling extra buffer types"))
        return LlamaLogLevel.info;
    else if (level === LlamaLogLevel.warn && message.startsWith("llama_context: non-unified KV cache requires ggml_set_rows() - forcing unified KV cache"))
        return LlamaLogLevel.info;
    else if (level === LlamaLogLevel.warn && message.startsWith("llama_kv_cache_unified: LLAMA_SET_ROWS=0, using old ggml_cpy() method for backwards compatibility"))
        return LlamaLogLevel.info;
    else if (level === LlamaLogLevel.warn && message.startsWith("init: embeddings required but some input tokens were not marked as outputs -> overriding"))
        return LlamaLogLevel.info;
    else if (level === LlamaLogLevel.warn && message.startsWith("load: special_eog_ids contains both '<|return|>' and '<|call|>' tokens, removing '<|end|>' token from EOG list"))
        return LlamaLogLevel.info;
    else if (level === LlamaLogLevel.warn && message.startsWith("llama_init_from_model: model default pooling_type is [0], but [-1] was specified"))
        return LlamaLogLevel.info;
    else if (level === LlamaLogLevel.warn && message.startsWith("llama_model_loader: direct I/O is enabled, disabling mmap"))
        return LlamaLogLevel.info;
    else if (level === LlamaLogLevel.warn && message.startsWith("llama_model_loader: direct I/O is not available, using mmap"))
        return LlamaLogLevel.info;
    else if (gpu === false && level === LlamaLogLevel.warn && message.startsWith("llama_adapter_lora_init_impl: lora for '") && message.endsWith("' cannot use buft 'CPU_REPACK', fallback to CPU"))
        return LlamaLogLevel.info;
    else if (gpu === "metal" && level === LlamaLogLevel.warn && message.startsWith("ggml_metal_device_init: tensor API disabled for"))
        return LlamaLogLevel.info;
    return level;
}
//# sourceMappingURL=Llama.js.map