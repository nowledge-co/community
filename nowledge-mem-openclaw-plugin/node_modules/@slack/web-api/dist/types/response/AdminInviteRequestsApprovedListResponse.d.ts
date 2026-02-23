import type { WebAPICallResult } from '../../WebClient';
export type AdminInviteRequestsApprovedListResponse = WebAPICallResult & {
    approved_requests?: ApprovedRequest[];
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ApprovedRequest {
    approved_by?: ApprovedBy;
    invite?: Invite;
    invite_request?: InviteRequest;
}
export interface ApprovedBy {
    actor_id?: string;
    actor_type?: string;
}
export interface Invite {
    date_created?: number;
    email?: string;
    id?: string;
    invite_preferences?: InvitePreferences;
    inviter_id?: string;
    is_bouncing?: boolean;
}
export interface InvitePreferences {
    channel_ids?: string[];
    is_domain_matched?: boolean;
    is_restricted?: boolean;
    is_ultra_restricted?: boolean;
}
export interface InviteRequest {
    channel_ids?: string[];
    date_created?: number;
    email?: string;
    id?: string;
    invite_type?: string;
    requester_ids?: string[];
}
export interface ResponseMetadata {
    next_cursor?: string;
}
//# sourceMappingURL=AdminInviteRequestsApprovedListResponse.d.ts.map