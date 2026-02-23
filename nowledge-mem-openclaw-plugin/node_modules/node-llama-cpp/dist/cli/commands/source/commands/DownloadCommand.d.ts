import process from "process";
import { CommandModule } from "yargs";
import { BuildGpu } from "../../../../bindings/types.js";
type DownloadCommandArgs = {
    repo?: string;
    release?: "latest" | string;
    arch?: typeof process.arch;
    nodeTarget?: string;
    gpu?: BuildGpu | "auto";
    skipBuild?: boolean;
    noBundle?: boolean;
    noUsageExample?: boolean;
};
export declare const DownloadCommand: CommandModule<object, DownloadCommandArgs>;
export declare function DownloadLlamaCppCommand(args: DownloadCommandArgs): Promise<void>;
export {};
