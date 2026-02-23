/**
 * CLI argument parsing and help display
 */
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { type ToolName } from "../core/tools/index.js";
export type Mode = "text" | "json" | "rpc";
export interface Args {
    provider?: string;
    model?: string;
    apiKey?: string;
    systemPrompt?: string;
    appendSystemPrompt?: string;
    thinking?: ThinkingLevel;
    continue?: boolean;
    resume?: boolean;
    help?: boolean;
    version?: boolean;
    mode?: Mode;
    noSession?: boolean;
    session?: string;
    sessionDir?: string;
    models?: string[];
    tools?: ToolName[];
    noTools?: boolean;
    extensions?: string[];
    noExtensions?: boolean;
    print?: boolean;
    export?: string;
    noSkills?: boolean;
    skills?: string[];
    promptTemplates?: string[];
    noPromptTemplates?: boolean;
    themes?: string[];
    noThemes?: boolean;
    listModels?: string | true;
    verbose?: boolean;
    messages: string[];
    fileArgs: string[];
    /** Unknown flags (potentially extension flags) - map of flag name to value */
    unknownFlags: Map<string, boolean | string>;
}
export declare function isValidThinkingLevel(level: string): level is ThinkingLevel;
export declare function parseArgs(args: string[], extensionFlags?: Map<string, {
    type: "boolean" | "string";
}>): Args;
export declare function printHelp(): void;
//# sourceMappingURL=args.d.ts.map