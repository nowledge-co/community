import type { WebAPICallResult } from '../../WebClient';
export type FilesGetUploadURLExternalResponse = WebAPICallResult & {
    error?: string;
    file_id?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    upload_url?: string;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=FilesGetUploadURLExternalResponse.d.ts.map