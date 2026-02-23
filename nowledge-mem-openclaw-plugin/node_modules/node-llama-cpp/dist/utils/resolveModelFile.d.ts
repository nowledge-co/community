import { ModelFileAccessTokens } from "./modelFileAccessTokens.js";
import { ModelDownloadEndpoints } from "./modelDownloadEndpoints.js";
export type ResolveModelFileOptions = {
    /**
     * The directory to resolve models from, and download models to.
     *
     * Default to `node-llama-cpp`'s default global models directory (`~/.node-llama-cpp/models`).
     */
    directory?: string;
    /**
     * When downloading a model file, whether to download the file if it doesn't exist.
     *
     * - `"auto"`: Download the file if it doesn't exist
     * - `false`: Don't download the file if it doesn't exist. Implies `verify: false` even if `verify` is set to `true`.
     *
     * Defaults to `"auto"`.
     */
    download?: "auto" | false;
    /**
     * When an existing model file that corresponds to the URI is found,
     * verify that it matches the expected size of the remote file.
     *
     * Defaults to `false`.
     */
    verify?: boolean;
    /**
     * The name of the file to be resolved.
     *
     * If provided and existing file is found with the same name, it will be returned.
     *
     * If provided and no existing file is found with the same name, the file will be downloaded with the provided name.
     */
    fileName?: string;
    /**
     * Additional headers to use when downloading a model file.
     */
    headers?: Record<string, string>;
    /**
     * When downloading a model file, show the download progress.
     *
     * Defaults to `true`.
     */
    cli?: boolean;
    /**
     * When downloading a model file, called on download progress
     */
    onProgress?: (status: {
        totalSize: number;
        downloadedSize: number;
    }) => void;
    /**
     * If true, the temporary file will be deleted if the download is canceled.
     *
     * Defaults to `true`.
     */
    deleteTempFileOnCancel?: boolean;
    /**
     * The number of parallel downloads to use when downloading split files.
     *
     * Defaults to `4`.
     */
    parallel?: number;
    /**
     * Tokens to use to access the remote model file when downloading.
     */
    tokens?: ModelFileAccessTokens;
    /**
     * Configure the URLs used for resolving model URIs.
     * @see [Model URIs](https://node-llama-cpp.withcat.ai/guide/downloading-models#model-uris)
     */
    endpoints?: ModelDownloadEndpoints;
    /**
     * The signal to use to cancel a download.
     */
    signal?: AbortSignal;
};
/**
 * Resolves a local model file path from a URI or file path, and downloads the necessary files first if needed.
 *
 * If a URL or a URI is given, it'll be resolved to the corresponding file path.
 * If the file path exists, it will be returned, otherwise it will be downloaded and then be returned.
 *
 * If a file path is given, and the path exists, it will be returned, otherwise an error will be thrown.
 *
 * Files are resolved from and downloaded to the `directory` option,
 * which defaults to `node-llama-cpp`'s default global models directory (`~/.node-llama-cpp/models`).
 *
 * Set the `cli` option to `false` to hide the download progress from the console.
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {getLlama, resolveModelFile} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * // resolve a model from Hugging Face to the models directory
 * const modelPath = await resolveModelFile(
 *     "hf:user/model:quant",
 *     path.join(__dirname, "models")
 * );
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({modelPath});
 * ```
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {getLlama, resolveModelFile} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * // resolve a model from a URL to the models directory
 * const modelPath = await resolveModelFile(
 *     "https://example.com/model.gguf",
 *     path.join(__dirname, "models")
 * );
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({modelPath});
 * ```
 * @example
 * ```typescript
 * import {fileURLToPath} from "url";
 * import path from "path";
 * import {getLlama, resolveModelFile} from "node-llama-cpp";
 *
 * const __dirname = path.dirname(fileURLToPath(import.meta.url));
 *
 * // resolve a local model that is in the models directory
 * const modelPath = await resolveModelFile(
 *     "model.gguf",
 *     path.join(__dirname, "models")
 * );
 *
 * const llama = await getLlama();
 * const model = await llama.loadModel({modelPath});
 * ```
 * @returns The resolved model file path
 */
export declare function resolveModelFile(uriOrPath: string, optionsOrDirectory?: ResolveModelFileOptions | string): Promise<string>;
