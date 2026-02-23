import { isUrl } from "./isUrl.js";
export function resolveHuggingFaceEndpoint(endpoints) {
    const ensureLastSlash = (url) => (url.endsWith("/")
        ? url
        : url + "/");
    if (endpoints?.huggingFace != null && isUrl(endpoints?.huggingFace, false))
        return ensureLastSlash(endpoints?.huggingFace);
    // https://github.com/ggml-org/llama.cpp/pull/12664/files#diff-201cbc8fd17750764ed4a0862232e81503550c201995e16dc2e2766754eaa57a
    const modelEndpoint = process.env.MODEL_ENDPOINT;
    if (modelEndpoint != null && isUrl(modelEndpoint, false))
        return ensureLastSlash(modelEndpoint);
    // https://github.com/ggml-org/llama.cpp/pull/12664/files#diff-201cbc8fd17750764ed4a0862232e81503550c201995e16dc2e2766754eaa57a
    const hfEndpoint = process.env.HF_ENDPOINT;
    if (hfEndpoint != null && isUrl(hfEndpoint, false))
        return ensureLastSlash(hfEndpoint);
    return "https://huggingface.co/";
}
export function isHuggingFaceUrl(url, endpoints) {
    const parsedUrl = new URL(url);
    const hfEndpoint = resolveHuggingFaceEndpoint(endpoints);
    const hfEndpointDomain = (new URL(hfEndpoint)).hostname;
    if (parsedUrl.hostname === hfEndpointDomain)
        return true;
    return ((hfEndpoint === "https://huggingface.co/" || hfEndpoint === "https://hf.co/") &&
        (parsedUrl.hostname === "huggingface.co" || parsedUrl.hostname === "hf.co"));
}
//# sourceMappingURL=modelDownloadEndpoints.js.map