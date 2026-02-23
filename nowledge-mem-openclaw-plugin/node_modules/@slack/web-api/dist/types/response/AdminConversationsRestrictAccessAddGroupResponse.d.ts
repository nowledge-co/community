import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsRestrictAccessAddGroupResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminConversationsRestrictAccessAddGroupResponse.d.ts.map