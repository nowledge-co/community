import type { WebAPICallResult } from '../../WebClient';
export type AdminUsersSessionInvalidateResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminUsersSessionInvalidateResponse.d.ts.map