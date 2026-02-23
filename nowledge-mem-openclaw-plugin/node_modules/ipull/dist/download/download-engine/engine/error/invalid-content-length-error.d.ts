import EngineError from "./engine-error.js";
export default class InvalidContentLengthError extends EngineError {
    constructor(url: string);
}
