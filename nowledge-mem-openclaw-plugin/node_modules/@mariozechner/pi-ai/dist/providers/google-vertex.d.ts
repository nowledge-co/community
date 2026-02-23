import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";
import type { GoogleThinkingLevel } from "./google-gemini-cli.js";
export interface GoogleVertexOptions extends StreamOptions {
    toolChoice?: "auto" | "none" | "any";
    thinking?: {
        enabled: boolean;
        budgetTokens?: number;
        level?: GoogleThinkingLevel;
    };
    project?: string;
    location?: string;
}
export declare const streamGoogleVertex: StreamFunction<"google-vertex", GoogleVertexOptions>;
export declare const streamSimpleGoogleVertex: StreamFunction<"google-vertex", SimpleStreamOptions>;
//# sourceMappingURL=google-vertex.d.ts.map