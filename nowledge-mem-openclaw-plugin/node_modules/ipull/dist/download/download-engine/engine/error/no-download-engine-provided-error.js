import EngineError from "./engine-error.js";
export class NoDownloadEngineProvidedError extends EngineError {
    constructor(error = "No download engine provided for download sequence") {
        super(error);
    }
}
//# sourceMappingURL=no-download-engine-provided-error.js.map