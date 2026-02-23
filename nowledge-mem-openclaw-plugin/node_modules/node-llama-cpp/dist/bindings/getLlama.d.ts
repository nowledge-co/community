import { LlamaGpuType, LlamaLogLevel, LlamaNuma } from "./types.js";
import { Llama } from "./Llama.js";
export type LlamaOptions = {
    /**
     * The compute layer implementation type to use for llama.cpp.
     * - **`"auto"`**: Automatically detect and use the best GPU available (Metal on macOS, and CUDA or Vulkan on Windows and Linux)
     * - **`"metal"`**: Use Metal.
     *   Only supported on macOS.
     *   Enabled by default on Apple Silicon Macs.
     * - **`"cuda"`**: Use CUDA.
     * - **`"vulkan"`**: Use Vulkan.
     * - **`false`**: Disable any GPU support and only use the CPU.
     *
     * `"auto"` by default.
     * @see Use the `getLlamaGpuTypes` function to get the available GPU types (from the above list) for the current machine at runtime.
     */
    gpu?: "auto" | LlamaGpuType | {
        type: "auto";
        exclude?: LlamaGpuType[];
    };
    /**
     * Set the minimum log level for llama.cpp.
     * Defaults to `"warn"`.
     */
    logLevel?: LlamaLogLevel;
    /**
     * Set a custom logger for llama.cpp logs.
     */
    logger?: (level: LlamaLogLevel, message: string) => void;
    /**
     * Set what build method to use.
     * - **`"auto"`**: If a local build is found, use it.
     * Otherwise, if a prebuilt binary is found, use it.
     * Otherwise, build from source.
     * - **`"never"`**: If a local build is found, use it.
     * Otherwise, if a prebuilt binary is found, use it.
     * Otherwise, throw a `NoBinaryFoundError` error.
     * - **`"forceRebuild"`**: Always build from source.
     * Be cautious with this option, as it will cause the build to fail on Windows when the binaries are in use by another process.
     * - **`"try"`**: If a local build is found, use it.
     * Otherwise, try to build from source and use the resulting binary.
     * If building from source fails, use a prebuilt binary if found.
     *
     * When running from inside an Asar archive in Electron, building from source is not possible, so it'll never build from source.
     * To allow building from source in Electron apps, make sure you ship `node-llama-cpp` as an unpacked module.
     *
     * Defaults to `"auto"`.
     * On Electron, defaults to `"never"`.
     */
    build?: "auto" | "never" | "forceRebuild" | "try";
    /**
     * Set custom CMake options for llama.cpp
     */
    cmakeOptions?: Record<string, string>;
    /**
     * When a prebuilt binary is found, only use it if it was built with the same build options as the ones specified in `buildOptions`.
     * Disabled by default.
     */
    existingPrebuiltBinaryMustMatchBuildOptions?: boolean;
    /**
     * Use prebuilt binaries if they match the build options.
     * Enabled by default.
     */
    usePrebuiltBinaries?: boolean;
    /**
     * Print binary compilation progress logs.
     * Enabled by default.
     */
    progressLogs?: boolean;
    /**
     * Don't download llama.cpp source if it's not found.
     * When set to `true`, and llama.cpp source is not found, a `NoBinaryFoundError` error will be thrown.
     * Disabled by default.
     */
    skipDownload?: boolean;
    /**
     * The maximum number of threads to use for the Llama instance.
     *
     * Set to `0` to have no thread limit.
     *
     * When not using a GPU, defaults to the number of CPU cores that are useful for math (`.cpuMathCores`), or `4`, whichever is higher.
     *
     * When using a GPU, there's no limit by default.
     */
    maxThreads?: number;
    /**
     * Pad the available VRAM for the memory size calculations, as these calculations are not always accurate.
     * Recommended to ensure stability.
     * This only affects the calculations of `"auto"` in function options and is not reflected in the `getVramState` function.
     *
     * Defaults to `6%` of the total VRAM or 1GB, whichever is lower.
     * Set to `0` to disable.
     */
    vramPadding?: number | ((totalVram: number) => number);
    /**
     * Pad the available RAM for the memory size calculations, as these calculations are not always accurate.
     * Recommended to ensure stability.
     *
     * Defaults to `25%` of the total RAM or 6GB (1GB on Linux), whichever is lower.
     * Set to `0` to disable.
     *
     * > Since the OS also needs RAM to function, the default value can get up to 6GB on Windows and macOS, and 1GB on Linux.
     */
    ramPadding?: number | ((totalRam: number) => number);
    /**
     * Enable debug mode to find issues with llama.cpp.
     * Makes logs print directly to the console from `llama.cpp` and not through the provided logger.
     *
     * Defaults to `false`.
     *
     * The default can be set using the `NODE_LLAMA_CPP_DEBUG` environment variable.
     */
    debug?: boolean;
    /**
     * Loads existing binaries without loading the `llama.cpp` backend,
     * and then disposes the returned `Llama` instance right away before returning it.
     *
     * Useful for performing a fast and efficient test to check whether the given configuration can be loaded.
     * Can be used for determining which GPU types the current machine supports before actually using them.
     *
     * Enabling this option implies that `build: "never"` and `skipDownload: true`.
     *
     * The returned `Llama` instance will be disposed and cannot be used.
     *
     * Defaults to `false`.
     */
    dryRun?: boolean;
    /**
     * NUMA (Non-Uniform Memory Access) allocation policy.
     *
     * On multi-socket or multi-cluster machines, each CPU "socket" (or node) has its own local memory.
     * Accessing memory on your own socket is fast, but another socket's memory is slower.
     * Setting a NUMA (Non-Uniform Memory Access) allocation policy can
     * dramatically improve performance by keeping data local and "close" to the socket.
     *
     * These are the available NUMA options:
     * - **`false`**: Don't set any NUMA policy - let the OS decide.
     * - **`"distribute"`**: Distribute the memory across all available NUMA nodes.
     * - **`"isolate"`**: Pin both threads and their memory to a single NUMA node to avoid cross-node traffic.
     * - **`"numactl"`**: Delegate NUMA management to the external `numactl` command (or `libnuma` library) to set the NUMA policy.
     * - **`"mirror"`**: Allocate memory on all NUMA nodes, and copy the data to all of them.
     *     This ensures minimal traffic between nodes, but uses more memory.
     *
     * Defaults to `false` (no NUMA policy).
     */
    numa?: LlamaNuma;
};
export type LastBuildOptions = {
    /**
     * Set the minimum log level for llama.cpp.
     * Defaults to "warn".
     */
    logLevel?: LlamaLogLevel;
    /**
     * Set a custom logger for llama.cpp logs.
     */
    logger?: (level: LlamaLogLevel, message: string) => void;
    /**
     * If a local build is not found, use prebuilt binaries.
     * Enabled by default.
     */
    usePrebuiltBinaries?: boolean;
    /**
     * If a local build is not found, and prebuilt binaries are not found, when building from source,
     * print binary compilation progress logs.
     * Enabled by default.
     */
    progressLogs?: boolean;
    /**
     * If a local build is not found, and prebuilt binaries are not found, don't download llama.cpp source if it's not found.
     * When set to `true`, and llama.cpp source is needed but is not found, a `NoBinaryFoundError` error will be thrown.
     * Disabled by default.
     */
    skipDownload?: boolean;
    /**
     * The maximum number of threads to use for the Llama instance.
     *
     * Set to `0` to have no thread limit.
     *
     * When not using a GPU, defaults to the number of CPU cores that are useful for math (`.cpuMathCores`), or `4`, whichever is higher.
     *
     * When using a GPU, there's no limit by default.
     */
    maxThreads?: number;
    /**
     * Pad the available VRAM for the memory size calculations, as these calculations are not always accurate.
     * Recommended to ensure stability.
     * This only affects the calculations of `"auto"` in function options and is not reflected in the `getVramState` function.
     *
     * Defaults to `6%` of the total VRAM or 1GB, whichever is lower.
     * Set to `0` to disable.
     */
    vramPadding?: number | ((totalVram: number) => number);
    /**
     * Pad the available RAM for the memory size calculations, as these calculations are not always accurate.
     * Recommended to ensure stability.
     *
     * Defaults to `25%` of the total RAM or 6GB (1GB on Linux), whichever is lower.
     * Set to `0` to disable.
     *
     * > Since the OS also needs RAM to function, the default value can get up to 6GB on Windows and macOS, and 1GB on Linux.
     */
    ramPadding?: number | ((totalRam: number) => number);
    /**
     * Enable debug mode to find issues with llama.cpp.
     * Makes logs print directly to the console from `llama.cpp` and not through the provided logger.
     *
     * Defaults to `false`.
     *
     * The default can be set using the `NODE_LLAMA_CPP_DEBUG` environment variable.
     */
    debug?: boolean;
    /**
     * Loads existing binaries without loading the `llama.cpp` backend,
     * and then disposes the returned `Llama` instance right away before returning it.
     *
     * Useful for performing a fast and efficient test to check whether the given configuration can be loaded.
     * Can be used for determining which GPU types the current machine supports before actually using them.
     *
     * Enabling this option implies that `build: "never"` and `skipDownload: true`.
     *
     * The returned `Llama` instance will be disposed and cannot be used.
     *
     * Defaults to `false`.
     */
    dryRun?: boolean;
    /**
     * NUMA (Non-Uniform Memory Access) allocation policy.
     *
     * On multi-socket or multi-cluster machines, each CPU "socket" (or node) has its own local memory.
     * Accessing memory on your own socket is fast, but another socket's memory is slower.
     * Setting a NUMA (Non-Uniform Memory Access) allocation policy can
     * dramatically improve performance by keeping data local and "close" to the socket.
     *
     * These are the available NUMA options:
     * - **`false`**: Don't set any NUMA policy - let the OS decide.
     * - **`"distribute"`**: Distribute the memory across all available NUMA nodes.
     * - **`"isolate"`**: Pin both threads and their memory to a single NUMA node to avoid cross-node traffic.
     * - **`"numactl"`**: Delegate NUMA management to the external `numactl` command (or `libnuma` library) to set the NUMA policy.
     * - **`"mirror"`**: Allocate memory on all NUMA nodes, and copy the data to all of them.
     *     This ensures minimal traffic between nodes, but uses more memory.
     *
     * Defaults to `false` (no NUMA policy).
     */
    numa?: LlamaNuma;
};
export declare const getLlamaFunctionName = "getLlama";
export declare const defaultLlamaVramPadding: (totalVram: number) => number;
export declare const defaultLlamaRamPadding: (totalRam: number) => number;
/**
 * Get a `llama.cpp` binding.
 *
 * Defaults to use a local binary built using the `source download` or `source build` CLI commands if one exists,
 * otherwise, uses a prebuilt binary, and fallbacks to building from source if a prebuilt binary is not found.
 *
 * Pass `"lastBuild"` to default to use the last successful build created
 * using the `source download` or `source build` CLI commands if one exists.
 *
 * The difference between using `"lastBuild"` and not using it is that `"lastBuild"` will use the binary built using a CLI command
 * with the configuration used to build that binary (like using its GPU type),
 * while not using `"lastBuild"` will only attempt to only use a binary that complies with the given options.
 *
 * For example, if your machine supports both CUDA and Vulkan, and you run the `source download --gpu vulkan` command,
 * calling `getLlama("lastBuild")` will return the binary you built with Vulkan,
 * while calling `getLlama()` will return a binding from a pre-built binary with CUDA,
 * since CUDA is preferable on systems that support it.
 *
 * For example, if your machine supports CUDA, and you run the `source download --gpu cuda` command,
 * calling `getLlama("lastBuild")` will return the binary you built with CUDA,
 * and calling `getLlama()` will also return that same binary you built with CUDA.
 *
 * You should prefer to use `getLlama()` without `"lastBuild"` unless you have a specific reason to use the last build.
 */
export declare function getLlama(options?: LlamaOptions): Promise<Llama>;
export declare function getLlama(type: "lastBuild", lastBuildOptions?: LastBuildOptions): Promise<Llama>;
export declare function getLlamaForOptions({ gpu, logLevel, logger, build, cmakeOptions, existingPrebuiltBinaryMustMatchBuildOptions, usePrebuiltBinaries, progressLogs, skipDownload, maxThreads, vramPadding, ramPadding, debug, numa, dryRun }: LlamaOptions, { updateLastBuildInfoOnCompile, skipLlamaInit, pipeBinaryTestErrorLogs }?: {
    updateLastBuildInfoOnCompile?: boolean;
    skipLlamaInit?: boolean;
    pipeBinaryTestErrorLogs?: boolean;
}): Promise<Llama>;
