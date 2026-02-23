import { ModelFileAccessTokens } from "./modelFileAccessTokens.js";
import { ModelDownloadEndpoints } from "./modelDownloadEndpoints.js";
export type ModelDownloaderOptions = ({
    /**
     * The URI to download the model from.
     *
     * The supported URI schemes are:
     * - **HTTP:** `https://`, `http://`
     * - **Hugging Face:** `hf:<user>/<model>:<quant>` (`:<quant>` is optional, but recommended)
     * - **Hugging Face:** `hf:<user>/<model>/<file-path>#<branch>` (`#<branch>` is optional)
     */
    modelUri: string;
} | {
    /**
     * @hidden
     * @deprecated Use `modelUri` instead.
     */
    modelUrl: string;
}) & {
    /**
     * The directory to save the model file to.
     * Default to `node-llama-cpp`'s default global models directory (`~/.node-llama-cpp/models`).
     */
    dirPath?: string;
    fileName?: string;
    headers?: Record<string, string>;
    /**
     * Defaults to `false`.
     */
    showCliProgress?: boolean;
    onProgress?: (status: {
        totalSize: number;
        downloadedSize: number;
    }) => void;
    /**
     * If true, the downloader will skip the download if the file already exists, and its size matches the size of the remote file.
     *
     * Defaults to `true`.
     */
    skipExisting?: boolean;
    /**
     * If true, the temporary file will be deleted when the download is canceled.
     *
     * Defaults to `true`.
     */
    deleteTempFileOnCancel?: boolean;
    /**
     * The number of parallel downloads to use when downloading split files.
     *
     * Defaults to `4`.
     */
    parallelDownloads?: number;
    /**
     * Tokens to use to access the remote model file when downloading.
     */
    tokens?: ModelFileAccessTokens;
    /**
     * Configure the URLs used for resolving model URIs.
     * @see [Model URIs](https://node-llama-cpp.withcat.ai/guide/downloading-models#model-uris)
     */
    endpoints?: ModelDownloadEndpoints;
};
/**
 * Create a model downloader to download a model from a URI.
 * Uses [`ipull`](https://github.com/ido-pluto/ipull) to download a model file as fast as possible with parallel connections
 * and other optimizations.
 *
 * If the uri points to a `.gguf` file that is split into multiple parts (for example, `model-00001-of-00009.gguf`),
 * all the parts will be downloaded to the specified directory.
 *
 * If the uri points to a `.gguf` file that is binary split into multiple parts (for example, `model.gguf.part1of9`),
 * all the parts will be spliced into a single file and be downloaded to the specified directory.
 *
 * If the uri points to a `.gguf` file that is not split or binary spliced (for example, `model.gguf`),
 * the file will be downloaded to the specified directory.
 *
 * The supported URI schemes are:
 * - **HTTP:** `https://`, `http://`
 * - **Hugging Face:** `hf:<user>/<model>:<quant>` (`:<quant>` is optional, but recommended)
 * - **Hugging Face:** `hf:<user>/<model>/<file-path>#<branch>` (`#<branch>` is optional)
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {createModelDownloader, getLlama} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * const downloader = await createModelDownloader({
 *     modelUri: "https://example.com/model.gguf",
 *     dirPath: path.join(__dirname, "models")
 * });
 * const modelPath = await downloader.download();
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({
 *     modelPath
 * });
 * ```
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {createModelDownloader, getLlama} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * const downloader = await createModelDownloader({
 *     modelUri: "hf:user/model:quant",
 *     dirPath: path.join(__dirname, "models")
 * });
 * const modelPath = await downloader.download();
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({
 *     modelPath
 * });
 * ```
 */
export declare function createModelDownloader(options: ModelDownloaderOptions): Promise<ModelDownloader>;
/**
 * Combine multiple models downloaders to a single downloader to download everything using as much parallelism as possible.
 *
 * You can check each individual model downloader for its download progress,
 * but only the `onProgress` passed to the combined downloader will be called during the download.
 *
 * When combining `ModelDownloader` instances, the following options on each individual `ModelDownloader` are ignored:
 * - `showCliProgress`
 * - `onProgress`
 * - `parallelDownloads`
 *
 * To set any of those options for the combined downloader, you have to pass them to the combined downloader instance.
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {createModelDownloader, combineModelDownloaders, getLlama} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * const downloaders = [
 *     createModelDownloader({
 *         modelUri: "https://example.com/model1.gguf",
 *         dirPath: path.join(__dirname, "models")
 *     }),
 *     createModelDownloader({
 *         modelUri: "hf:user/model2:quant",
 *         dirPath: path.join(__dirname, "models")
 *     }),
 *     createModelDownloader({
 *         modelUri: "hf:user/model/model3.gguf",
 *         dirPath: path.join(__dirname, "models")
 *     })
 * ];
 * const combinedDownloader = await combineModelDownloaders(downloaders, {
 *     showCliProgress: true // show download progress in the CLI
 * });
 * const [
 *     model1Path,
 *     model2Path,
 *     model3Path
 * ] = await combinedDownloader.download();
 *
 * const llama = await getLlama();
 * const model1 = await llama.loadModel({
 *     modelPath: model1Path!
 * });
 * const model2 = await llama.loadModel({
 *     modelPath: model2Path!
 * });
 * const model3 = await llama.loadModel({
 *     modelPath: model3Path!
 * });
 * ```
 */
export declare function combineModelDownloaders(downloaders: (ModelDownloader | Promise<ModelDownloader>)[], options?: CombinedModelDownloaderOptions): Promise<CombinedModelDownloader>;
export declare class ModelDownloader {
    private constructor();
    /**
     * The filename of the entrypoint file that should be used to load the model.
     */
    get entrypointFilename(): string;
    /**
     * The full path to the entrypoint file that should be used to load the model.
     */
    get entrypointFilePath(): string;
    /**
     * If the model is binary spliced from multiple parts, this will return the number of those binary parts.
     */
    get splitBinaryParts(): number | undefined;
    /**
     * The total number of files that will be saved to the directory.
     * For split files, this will be the number of split parts, as multiple files will be saved.
     * For binary-split files, this will be 1, as the parts will be spliced into a single file.
     */
    get totalFiles(): number;
    get totalSize(): number;
    get downloadedSize(): number;
    /**
     * @returns The path to the entrypoint file that should be used to load the model
     */
    download({ signal }?: {
        signal?: AbortSignal;
    }): Promise<string>;
    cancel({ deleteTempFile }?: {
        /**
         * Delete the temporary file that was created during the download.
         *
         * Defaults to the value of `deleteTempFileOnCancel` in the constructor.
         */
        deleteTempFile?: boolean;
    }): Promise<void>;
}
export type CombinedModelDownloaderOptions = {
    /**
     * Defaults to `false`.
     */
    showCliProgress?: boolean;
    onProgress?: (status: {
        totalSize: number;
        downloadedSize: number;
    }) => void;
    /**
     * The number of parallel downloads to use fo files.
     *
     * Defaults to `4`.
     */
    parallelDownloads?: number;
};
export declare class CombinedModelDownloader {
    /**
     * When combining `ModelDownloader` instances, the following options on each individual `ModelDownloader` are ignored:
     * - `showCliProgress`
     * - `onProgress`
     * - `parallelDownloads`
     *
     * To set any of those options for the combined downloader, you have to pass them to the combined downloader instance
     */
    private constructor();
    cancel(): Promise<void>;
    /**
     * @returns The paths to the entrypoint files that should be used to load the models
     */
    download({ signal }?: {
        signal?: AbortSignal;
    }): Promise<string[]>;
    get modelDownloaders(): readonly ModelDownloader[];
    /**
     * The filename of the entrypoint files that should be used to load the models.
     */
    get entrypointFilenames(): string[];
    /**
     * The full paths to the entrypoint files that should be used to load the models.
     */
    get entrypointFilePaths(): string[];
    /**
     * The accumulation of `totalFiles` of all the model downloaders
     */
    get totalFiles(): number;
    get totalSize(): number;
    get downloadedSize(): number;
}
