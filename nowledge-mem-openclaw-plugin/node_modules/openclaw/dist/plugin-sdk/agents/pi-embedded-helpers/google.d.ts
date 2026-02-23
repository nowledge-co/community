import { sanitizeGoogleTurnOrdering } from "./bootstrap.js";
export declare function isGoogleModelApi(api?: string | null): boolean;
export declare function isAntigravityClaude(params: {
    api?: string | null;
    provider?: string | null;
    modelId?: string;
}): boolean;
export { sanitizeGoogleTurnOrdering };
