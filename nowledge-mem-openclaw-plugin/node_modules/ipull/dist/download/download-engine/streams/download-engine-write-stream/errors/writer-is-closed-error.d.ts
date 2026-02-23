import WriterError from "./writer-error.js";
export default class WriterIsClosedError extends WriterError {
    constructor(message?: string);
}
