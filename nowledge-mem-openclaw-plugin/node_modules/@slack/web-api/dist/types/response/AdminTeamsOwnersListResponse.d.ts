import type { WebAPICallResult } from '../../WebClient';
export type AdminTeamsOwnersListResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    owner_ids?: string[];
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    next_cursor?: string;
}
//# sourceMappingURL=AdminTeamsOwnersListResponse.d.ts.map