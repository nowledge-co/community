import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsWhitelistListGroupsLinkedToChannelResponse = WebAPICallResult & {
    error?: string;
    group_ids?: string[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    warning?: string;
};
export interface ResponseMetadata {
    messages?: string[];
    warnings?: string[];
}
//# sourceMappingURL=AdminConversationsWhitelistListGroupsLinkedToChannelResponse.d.ts.map