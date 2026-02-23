import FetchStreamError from "./fetch-stream-error.js";
export default class PathNotAFileError extends FetchStreamError {
    constructor(path: string);
}
