import { CommandModule } from "yargs";
import { BuildGpu } from "../../../../bindings/types.js";
type InspectEstimateCommand = {
    modelPath: string;
    header?: string[];
    gpu?: BuildGpu | "auto";
    gpuLayers?: number | "max";
    contextSize?: number | "train";
    embedding?: boolean;
    noMmap?: boolean;
    swaFullCache?: boolean;
};
export declare const InspectEstimateCommand: CommandModule<object, InspectEstimateCommand>;
export {};
