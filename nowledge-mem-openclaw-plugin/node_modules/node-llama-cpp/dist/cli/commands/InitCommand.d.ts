import { CommandModule } from "yargs";
import { BuildGpu } from "../../bindings/types.js";
type InitCommand = {
    name?: string;
    template?: string;
    model?: string;
    gpu?: BuildGpu | "auto";
};
export declare const InitCommand: CommandModule<object, InitCommand>;
export declare const CreateCliCommand: CommandModule<object, InitCommand>;
export declare function InitCommandHandler({ name, template, model, gpu }: InitCommand): Promise<void>;
export {};
