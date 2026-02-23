import { BuildOptions } from "../types.js";
export declare function getBuildFolderNameForBuildOptions(buildOptions: BuildOptions): Promise<{
    withoutCustomCmakeOptions: string;
    withCustomCmakeOptions: string;
    binVariant: string;
}>;
