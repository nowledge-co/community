import EngineError from "./engine-error.js";
export default class DownloadAlreadyStartedError extends EngineError {
    constructor() {
        super("Download already started");
    }
}
//# sourceMappingURL=download-already-started-error.js.map