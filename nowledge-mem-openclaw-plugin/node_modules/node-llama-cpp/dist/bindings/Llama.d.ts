import { EventRelay } from "lifecycle-utils";
import { LlamaModel, LlamaModelOptions } from "../evaluator/LlamaModel/LlamaModel.js";
import { GbnfJsonDefList, GbnfJsonSchema } from "../utils/gbnfJson/types.js";
import { LlamaJsonSchemaGrammar } from "../evaluator/LlamaJsonSchemaGrammar.js";
import { LlamaGrammar, LlamaGrammarOptions } from "../evaluator/LlamaGrammar.js";
import { LlamaClasses } from "../utils/getLlamaClasses.js";
import { LlamaGpuType, LlamaLogLevel, LlamaNuma } from "./types.js";
export declare const LlamaLogLevelToAddonLogLevel: ReadonlyMap<LlamaLogLevel, number>;
export declare class Llama {
    private _classes?;
    readonly onDispose: EventRelay<void>;
    private constructor();
    dispose(): Promise<void>;
    /** @hidden */
    [Symbol.asyncDispose](): Promise<void>;
    get disposed(): boolean;
    get classes(): LlamaClasses;
    get gpu(): LlamaGpuType;
    get supportsGpuOffloading(): boolean;
    get supportsMmap(): boolean;
    get gpuSupportsMmap(): boolean;
    get supportsMlock(): boolean;
    /** The number of CPU cores that are useful for math */
    get cpuMathCores(): number;
    /**
     * The maximum number of threads that can be used by the Llama instance.
     *
     * If set to `0`, the Llama instance will have no limit on the number of threads.
     *
     * See the `maxThreads` option of `getLlama` for more information.
     */
    get maxThreads(): number;
    set maxThreads(value: number);
    /**
     * See the `numa` option of `getLlama` for more information
     */
    get numa(): LlamaNuma;
    get logLevel(): LlamaLogLevel;
    set logLevel(value: LlamaLogLevel);
    get logger(): (level: LlamaLogLevel, message: string) => void;
    set logger(value: (level: LlamaLogLevel, message: string) => void);
    get buildType(): "localBuild" | "prebuilt";
    get cmakeOptions(): Readonly<Record<string, string>>;
    get llamaCppRelease(): {
        readonly repo: string;
        readonly release: string;
    };
    get systemInfo(): string;
    /**
     * VRAM padding used for memory size calculations, as these calculations are not always accurate.
     * This is set by default to ensure stability, but can be configured when you call `getLlama`.
     *
     * See `vramPadding` on `getLlama` for more information.
     */
    get vramPaddingSize(): number;
    /**
     * The total amount of VRAM that is currently being used.
     *
     * `unifiedSize` represents the amount of VRAM that is shared between the CPU and GPU.
     * On SoC devices, this is usually the same as `total`.
     */
    getVramState(): Promise<{
        total: number;
        used: number;
        free: number;
        unifiedSize: number;
    }>;
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
    getSwapState(): Promise<{
        /**
         * The maximum size of the swap memory that the system can allocate.
         * If the swap size is dynamic (like on macOS), this will be `Infinity`
         */
        maxSize: number;
        /** The total size allocated by the system for swap memory */
        allocated: number;
        /** The amount of swap memory that is currently being used from the `allocated` size */
        used: number;
    }>;
    getGpuDeviceNames(): Promise<string[]>;
    loadModel(options: LlamaModelOptions): Promise<LlamaModel>;
    /**
     * @see [Using a JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#json-schema) tutorial
     * @see [Reducing Hallucinations When Using JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#reducing-json-schema-hallucinations) tutorial
     */
    createGrammarForJsonSchema<const T extends GbnfJsonSchema<Defs>, const Defs extends GbnfJsonDefList<Defs> = Record<any, any>>(schema: Readonly<T> & GbnfJsonSchema<Defs>): Promise<LlamaJsonSchemaGrammar<T, Defs>>;
    getGrammarFor(type: Parameters<typeof LlamaGrammar.getFor>[1]): Promise<LlamaGrammar>;
    /**
     * @see [Using Grammar](https://node-llama-cpp.withcat.ai/guide/grammar) tutorial
     */
    createGrammar(options: LlamaGrammarOptions): Promise<LlamaGrammar>;
    static defaultConsoleLogger(level: LlamaLogLevel, message: string): void;
}
