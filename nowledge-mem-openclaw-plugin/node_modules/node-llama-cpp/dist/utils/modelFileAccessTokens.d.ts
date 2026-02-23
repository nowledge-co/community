import { ModelDownloadEndpoints } from "./modelDownloadEndpoints.js";
export type ModelFileAccessTokens = {
    huggingFace?: string;
};
export declare function resolveModelFileAccessTokensTryHeaders(modelUrl: string, tokens?: ModelFileAccessTokens, endpoints?: ModelDownloadEndpoints, baseHeaders?: Record<string, string>): Promise<Record<string, string>[]>;
