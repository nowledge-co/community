let isInDocumentationMode = false;
let isInCLI = false;
let forceShowConsoleLogPrefix = false;
export function getIsInDocumentationMode() {
    return isInDocumentationMode;
}
export function setIsInDocumentationMode(value) {
    isInDocumentationMode = value;
}
export function getIsRunningFromCLI() {
    return isInCLI;
}
export function setIsRunningFromCLI(value) {
    isInCLI = value;
}
export function getForceShowConsoleLogPrefix() {
    return forceShowConsoleLogPrefix;
}
export function setForceShowConsoleLogPrefix(value) {
    forceShowConsoleLogPrefix = value;
}
//# sourceMappingURL=state.js.map