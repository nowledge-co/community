import type { WebAPICallResult } from '../../WebClient';
export type AdminInviteRequestsListResponse = WebAPICallResult & {
    error?: string;
    invite_requests?: InviteRequest[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface InviteRequest {
    channel_ids?: string[];
    date_created?: number;
    date_expire?: number;
    email?: string;
    id?: string;
    invite_type?: string;
    request_reason?: string;
    requester_ids?: string[];
}
export interface ResponseMetadata {
    next_cursor?: string;
}
//# sourceMappingURL=AdminInviteRequestsListResponse.d.ts.map