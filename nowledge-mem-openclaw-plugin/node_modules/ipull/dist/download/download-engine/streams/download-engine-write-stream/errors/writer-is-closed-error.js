import WriterError from "./writer-error.js";
export default class WriterIsClosedError extends WriterError {
    constructor(message = "Writer is closed") {
        super(message);
    }
}
//# sourceMappingURL=writer-is-closed-error.js.map