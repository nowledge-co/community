import SmartChunkSplit from "./smart-chunk-split.js";
import BaseDownloadEngineFetchStream from "../base-download-engine-fetch-stream.js";
type IStreamResponse = {
    on(event: "data", listener: (chunk: Uint8Array) => void): IStreamResponse;
    on(event: "close", listener: () => void): IStreamResponse;
    on(event: "error", listener: (error: Error) => void): IStreamResponse;
    pause(): void;
    resume(): void;
    destroy(): void;
};
export default function streamResponse(stream: IStreamResponse, downloadEngine: BaseDownloadEngineFetchStream, smartSplit: SmartChunkSplit, onProgress?: (leftOverLength: number) => void): Promise<void>;
export {};
