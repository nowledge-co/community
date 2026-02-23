import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsRestrictAccessListGroupsResponse = WebAPICallResult & {
    error?: string;
    group_ids?: string[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminConversationsRestrictAccessListGroupsResponse.d.ts.map