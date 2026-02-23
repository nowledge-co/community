/**
 * System prompt construction and project context loading
 */
import { type Skill } from "./skills.js";
export interface BuildSystemPromptOptions {
    /** Custom system prompt (replaces default). */
    customPrompt?: string;
    /** Tools to include in prompt. Default: [read, bash, edit, write] */
    selectedTools?: string[];
    /** Text to append to system prompt. */
    appendSystemPrompt?: string;
    /** Working directory. Default: process.cwd() */
    cwd?: string;
    /** Pre-loaded context files. */
    contextFiles?: Array<{
        path: string;
        content: string;
    }>;
    /** Pre-loaded skills. */
    skills?: Skill[];
}
/** Build the system prompt with tools, guidelines, and context */
export declare function buildSystemPrompt(options?: BuildSystemPromptOptions): string;
//# sourceMappingURL=system-prompt.d.ts.map