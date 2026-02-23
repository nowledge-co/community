import { WriteCallback } from "../base-download-engine-fetch-stream.js";
export type SmartChunkSplitOptions = {
    chunkSize: number;
    startChunk: number;
};
export default class SmartChunkSplit {
    private readonly _callback;
    private readonly _options;
    private _bytesWriteLocation;
    private _bytesLeftovers;
    private _chunks;
    constructor(_callback: WriteCallback, _options: SmartChunkSplitOptions);
    addChunk(data: Uint8Array): void;
    get savedLength(): number;
    sendLeftovers(): void;
    private _sendChunk;
}
