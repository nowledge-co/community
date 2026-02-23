import WriterError from "./writer-error.js";
export default class WriterNotDefineError extends WriterError {
    constructor(message?: string);
}
