import { CommandModule } from "yargs";
declare const debugFunctions: readonly ["vram", "cmakeOptions"];
type DebugCommand = {
    function: (typeof debugFunctions)[number];
};
export declare const DebugCommand: CommandModule<object, DebugCommand>;
export {};
