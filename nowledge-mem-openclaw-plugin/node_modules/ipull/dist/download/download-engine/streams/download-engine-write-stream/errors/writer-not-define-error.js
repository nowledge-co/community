import WriterError from "./writer-error.js";
export default class WriterNotDefineError extends WriterError {
    constructor(message = "Writer is not defined") {
        super(message);
    }
}
//# sourceMappingURL=writer-not-define-error.js.map