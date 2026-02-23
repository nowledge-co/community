import type { WebAPICallResult } from '../../WebClient';
export type AdminInviteRequestsDeniedListResponse = WebAPICallResult & {
    denied_requests?: DeniedRequest[];
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface DeniedRequest {
    denied_by?: DeniedBy;
    invite_request?: InviteRequest;
}
export interface DeniedBy {
    actor_id?: string;
    actor_type?: string;
}
export interface InviteRequest {
    channel_ids?: string[];
    date_created?: number;
    email?: string;
    id?: string;
    invite_type?: string;
    request_reason?: string;
    requester_ids?: string[];
}
export interface ResponseMetadata {
    next_cursor?: string;
}
//# sourceMappingURL=AdminInviteRequestsDeniedListResponse.d.ts.map