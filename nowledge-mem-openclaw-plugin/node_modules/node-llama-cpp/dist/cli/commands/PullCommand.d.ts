import { CommandModule } from "yargs";
type PullCommand = {
    urls: string[];
    header?: string[];
    override: boolean;
    noProgress: boolean;
    noTempFile: boolean;
    directory: string;
    filename?: string;
    parallel?: number;
};
export declare const PullCommand: CommandModule<object, PullCommand>;
export {};
