export class LlamaFunctionCallValidationError extends Error {
    functions;
    chatWrapper;
    callText;
    constructor(message, functions, chatWrapper, callText) {
        super(message);
        this.functions = functions;
        this.chatWrapper = chatWrapper;
        this.callText = callText;
    }
}
//# sourceMappingURL=LlamaFunctionCallValidationError.js.map