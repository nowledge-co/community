export declare function getBuildDefaults(): Promise<{
    repo: string;
    release: string;
    gpuSupport: false | "metal" | "cuda" | "vulkan" | "auto";
}>;
