import process from "process";
import { CommandModule } from "yargs";
import { BuildGpu } from "../../../../bindings/types.js";
type BuildCommand = {
    arch?: typeof process.arch;
    nodeTarget?: string;
    gpu?: BuildGpu | "auto";
    noUsageExample?: boolean;
};
export declare const BuildCommand: CommandModule<object, BuildCommand>;
export declare function BuildLlamaCppCommand({ arch, nodeTarget, gpu, noUsageExample, 
/** @internal */
noCustomCmakeBuildOptionsInBinaryFolderName, 
/** @internal */
ciMode }: BuildCommand): Promise<void>;
export {};
