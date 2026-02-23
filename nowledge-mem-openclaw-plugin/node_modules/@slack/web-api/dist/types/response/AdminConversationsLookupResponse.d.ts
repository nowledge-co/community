import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsLookupResponse = WebAPICallResult & {
    channel_ids?: string[];
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    next_cursor?: string;
}
//# sourceMappingURL=AdminConversationsLookupResponse.d.ts.map