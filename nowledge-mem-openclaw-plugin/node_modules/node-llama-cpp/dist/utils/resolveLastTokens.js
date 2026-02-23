import { maxRecentDetokenizerTokens } from "../consts.js";
export function resolveLastTokens(tokenArrays, maxTokens = maxRecentDetokenizerTokens) {
    const lastTokens = [];
    for (let i = tokenArrays.length - 1; i >= 0 && lastTokens.length < maxTokens; i--) {
        const tokens = tokenArrays[i];
        for (let j = tokens.length - 1; j >= 0 && lastTokens.length < maxTokens; j--) {
            lastTokens.unshift(tokens[j]);
        }
    }
    return lastTokens;
}
//# sourceMappingURL=resolveLastTokens.js.map