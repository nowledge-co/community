import { ModelFileAccessTokens } from "./modelFileAccessTokens.js";
import { ModelDownloadEndpoints } from "./modelDownloadEndpoints.js";
export declare const genericFilePartNumber: "{:\n{number}\n:}";
export type ParsedModelUri = ResolvedParsedModelUri | UnresolvedParsedModelUri;
export type UnresolvedParsedModelUri = {
    type: "unresolved";
    uri: string;
    filePrefix: string;
    baseFilename: string;
    possibleFullFilenames: (string | `${string}${typeof genericFilePartNumber}${string}`)[];
    resolveDetails: {
        type: "hf";
        user: string;
        model: string;
        tag: string;
    };
};
export type ResolvedParsedModelUri = {
    type: "resolved";
    uri: string;
    resolvedUrl: string;
    filePrefix: string;
    filename: string;
    fullFilename: string;
};
export declare function parseModelUri(urlOrUri: string, convertUrlToSupportedUri?: boolean, endpoints?: ModelDownloadEndpoints): ParsedModelUri | null;
export declare function isModelUri(modelUri: string): boolean;
export declare function resolveParsedModelUri(modelUri: ParsedModelUri, options?: {
    tokens?: ModelFileAccessTokens;
    endpoints?: ModelDownloadEndpoints;
    signal?: AbortSignal;
    authorizationHeader?: string;
}): Promise<ResolvedParsedModelUri>;
export declare function resolveParsedModelUri(modelUri: ParsedModelUri | undefined | null, options?: {
    tokens?: ModelFileAccessTokens;
    endpoints?: ModelDownloadEndpoints;
    signal?: AbortSignal;
    authorizationHeader?: string;
}): Promise<ResolvedParsedModelUri | undefined | null>;
export declare function getAuthorizationHeader(headers?: Record<string, string>): string | undefined;
