import { ParsedModelUri } from "./parseModelUri.js";
import { ModelDownloadEndpoints } from "./modelDownloadEndpoints.js";
export type ResolveModelDestination = {
    type: "url";
    url: string;
} | {
    type: "uri";
    url?: string;
    uri: string;
    parsedUri: ParsedModelUri;
} | {
    type: "file";
    path: string;
};
export declare function resolveModelDestination(modelDestination: string, convertUrlToUri?: boolean, endpoints?: ModelDownloadEndpoints): ResolveModelDestination;
export declare function resolveModelArgToFilePathOrUrl(modelDestination: string, optionHeaders?: Record<string, string>): Promise<[resolvedModelDestination: ResolveModelDestination, filePathOrUrl: string]>;
