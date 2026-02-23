import { CommandModule } from "yargs";
type InspectGgufCommand = {
    modelPath: string;
    header?: string[];
    key?: string;
    noSplice: boolean;
    fullTensorInfo: boolean;
    fullMetadataArrays: boolean;
    plainJson: boolean;
    outputToJsonFile?: string;
};
export declare const InspectGgufCommand: CommandModule<object, InspectGgufCommand>;
export {};
