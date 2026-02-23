import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsRestrictAccessRemoveGroupResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminConversationsRestrictAccessRemoveGroupResponse.d.ts.map