import HttpError from "./http-error.js";
export default class InvalidContentLengthError extends HttpError {
    constructor(expectedLength: number, gotLength: number | string);
}
