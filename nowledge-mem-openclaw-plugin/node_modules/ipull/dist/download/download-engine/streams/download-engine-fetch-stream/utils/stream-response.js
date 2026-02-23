import { promiseWithResolvers } from "./retry-async-statement.js";
export default async function streamResponse(stream, downloadEngine, smartSplit, onProgress) {
    const { promise, resolve, reject } = promiseWithResolvers();
    stream.on("data", (chunk) => {
        smartSplit.addChunk(chunk);
        onProgress?.(smartSplit.savedLength);
    });
    stream.on("close", () => {
        smartSplit.sendLeftovers();
        resolve();
    });
    stream.on("error", (error) => {
        reject(error);
    });
    const pause = stream.pause.bind(stream);
    const resume = stream.resume.bind(stream);
    const close = stream.destroy.bind(stream);
    downloadEngine.on("paused", pause);
    downloadEngine.on("resumed", resume);
    downloadEngine.on("aborted", close);
    try {
        await promise;
    }
    finally {
        downloadEngine.off("paused", pause);
        downloadEngine.off("resumed", resume);
        downloadEngine.off("aborted", close);
        stream.destroy();
    }
}
//# sourceMappingURL=stream-response.js.map