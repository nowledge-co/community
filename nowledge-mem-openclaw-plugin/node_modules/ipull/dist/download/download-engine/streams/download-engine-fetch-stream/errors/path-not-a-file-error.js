import FetchStreamError from "./fetch-stream-error.js";
export default class PathNotAFileError extends FetchStreamError {
    constructor(path) {
        super(`Path is not a file: ${path}`);
    }
}
//# sourceMappingURL=path-not-a-file-error.js.map