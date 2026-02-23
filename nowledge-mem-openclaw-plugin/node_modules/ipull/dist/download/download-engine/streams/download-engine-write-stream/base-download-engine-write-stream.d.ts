export default abstract class BaseDownloadEngineWriteStream {
    abstract write(cursor: number, buffer: Uint8Array): Promise<void> | void;
    close(): void | Promise<void>;
}
