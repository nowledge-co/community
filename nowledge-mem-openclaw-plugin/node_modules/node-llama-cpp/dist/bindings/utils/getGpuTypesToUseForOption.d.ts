import process from "process";
import { BuildGpu } from "../types.js";
import { LlamaOptions } from "../getLlama.js";
import { BinaryPlatform } from "./getPlatform.js";
export declare function getGpuTypesToUseForOption(gpu: Required<LlamaOptions>["gpu"], { platform, arch }?: {
    platform?: BinaryPlatform;
    arch?: typeof process.arch;
}): Promise<BuildGpu[]>;
export declare function resolveValidGpuOptionForPlatform(gpu: BuildGpu | "auto", { platform, arch }: {
    platform: BinaryPlatform;
    arch: typeof process.arch;
}): false | "metal" | "cuda" | "vulkan" | "auto";
