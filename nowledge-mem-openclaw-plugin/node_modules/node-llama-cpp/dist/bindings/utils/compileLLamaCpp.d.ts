import process from "process";
import { BuildMetadataFile, BuildOptions } from "../types.js";
export declare function compileLlamaCpp(buildOptions: BuildOptions, compileOptions: {
    nodeTarget?: string;
    updateLastBuildInfo?: boolean;
    includeBuildOptionsInBinaryFolderName?: boolean;
    ensureLlamaCppRepoIsCloned?: boolean;
    downloadCmakeIfNeeded?: boolean;
    ignoreWorkarounds?: ("cudaArchitecture" | "reduceParallelBuildThreads" | "singleBuildThread" | "avoidWindowsLlvm")[];
    envVars?: typeof process.env;
    ciMode?: boolean;
}): Promise<void>;
export declare function getLocalBuildBinaryPath(folderName: string): Promise<string | null>;
export declare function getLocalBuildBinaryBuildMetadata(folderName: string): Promise<BuildMetadataFile>;
export declare function getPrebuiltBinaryPath(buildOptions: BuildOptions, folderName: string): Promise<{
    binaryPath: string;
    folderName: string;
    folderPath: string;
    extBackendsPath: string | undefined;
} | null>;
export declare function getPrebuiltBinaryBuildMetadata(folderPath: string, folderName: string): Promise<BuildMetadataFile>;
