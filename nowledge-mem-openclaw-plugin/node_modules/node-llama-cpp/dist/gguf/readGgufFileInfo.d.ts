import retry from "async-retry";
import { ModelFileAccessTokens } from "../utils/modelFileAccessTokens.js";
import { ModelDownloadEndpoints } from "../utils/modelDownloadEndpoints.js";
import { GgufFileInfo } from "./types/GgufFileInfoTypes.js";
/**
 * Read a GGUF file and return its metadata and tensor info (unless `readTensorInfo` is set to `false`).
 * Only the parts of the file required for the metadata and tensor info are read.
 * @param pathOrUri
 * @param options
 */
export declare function readGgufFileInfo(pathOrUri: string, { readTensorInfo, sourceType, ignoreKeys, logWarnings, fetchRetryOptions, fetchHeaders, spliceSplitFiles, signal, tokens, endpoints }?: {
    /**
     * Whether to read the tensor info from the file's header.
     *
     * Defaults to `true`.
     */
    readTensorInfo?: boolean;
    /**
     * Set to a specific value to force it to only use that source type.
     * By default, it detects whether the path is a network URL or a filesystem path and uses the appropriate reader accordingly.
     */
    sourceType?: "network" | "filesystem";
    /**
     * Metadata keys to ignore when parsing the metadata.
     * For example, `["tokenizer.ggml.tokens"]`
     */
    ignoreKeys?: string[];
    /**
     * Whether to log warnings
     *
     * Defaults to `true`.
     */
    logWarnings?: boolean;
    /** Relevant only when fetching from a network */
    fetchRetryOptions?: retry.Options;
    /** Relevant only when fetching from a network */
    fetchHeaders?: Record<string, string>;
    /**
     * When split files are detected, read the metadata of the first file and splice the tensor info from all the parts.
     *
     * Defaults to `true`.
     */
    spliceSplitFiles?: boolean;
    signal?: AbortSignal;
    /**
     * Tokens to use to access the remote model file.
     */
    tokens?: ModelFileAccessTokens;
    /**
     * Configure the URLs used for resolving model URIs.
     * @see [Model URIs](https://node-llama-cpp.withcat.ai/guide/downloading-models#model-uris)
     */
    endpoints?: ModelDownloadEndpoints;
}): Promise<GgufFileInfo>;
