export const allSegmentTypes = ["thought", "comment"];
void null;
export function isChatModelResponseFunctionCall(item) {
    if (item == null || typeof item === "string")
        return false;
    return item.type === "functionCall";
}
export function isChatModelResponseSegment(item) {
    if (item == null || typeof item === "string")
        return false;
    return item.type === "segment";
}
//# sourceMappingURL=types.js.map