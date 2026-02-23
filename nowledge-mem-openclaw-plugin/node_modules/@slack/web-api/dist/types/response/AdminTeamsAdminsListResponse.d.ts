import type { WebAPICallResult } from '../../WebClient';
export type AdminTeamsAdminsListResponse = WebAPICallResult & {
    admin_ids?: string[];
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    next_cursor?: string;
}
//# sourceMappingURL=AdminTeamsAdminsListResponse.d.ts.map