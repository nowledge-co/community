import { InvalidOptionError } from "./InvalidOptionError.js";
export default class UrlInputError extends InvalidOptionError {
    constructor(message: string);
}
