export type ModelDownloadEndpoints = {
    /**
     * Endpoint to use for resolving Hugging Face model URIs (`hf:`).
     *
     * Can also be set by using the environment variable `HF_ENDPOINT` or `MODEL_ENDPOINT`.
     *
     * Defaults to `"https://huggingface.co/"`.
     * @see [Model URIs](https://node-llama-cpp.withcat.ai/guide/downloading-models#model-uris)
     */
    huggingFace?: string;
};
export declare function resolveHuggingFaceEndpoint(endpoints?: ModelDownloadEndpoints): string;
export declare function isHuggingFaceUrl(url: string, endpoints?: ModelDownloadEndpoints): boolean;
