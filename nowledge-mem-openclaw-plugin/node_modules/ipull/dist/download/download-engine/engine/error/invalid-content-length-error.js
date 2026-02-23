import EngineError from "./engine-error.js";
export default class InvalidContentLengthError extends EngineError {
    constructor(url) {
        super(`Invalid content length, for request URL: ${url}`);
    }
}
//# sourceMappingURL=invalid-content-length-error.js.map