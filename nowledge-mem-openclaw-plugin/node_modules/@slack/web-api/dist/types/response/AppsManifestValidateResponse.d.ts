import type { WebAPICallResult } from '../../WebClient';
export type AppsManifestValidateResponse = WebAPICallResult & {
    error?: string;
    errors?: Error[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface Error {
    code?: string;
    message?: string;
    pointer?: string;
    related_component?: string;
}
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AppsManifestValidateResponse.d.ts.map