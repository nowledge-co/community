import { InvalidOptionError } from "./InvalidOptionError.js";
export default class SavePathError extends InvalidOptionError {
    constructor(message: string);
}
