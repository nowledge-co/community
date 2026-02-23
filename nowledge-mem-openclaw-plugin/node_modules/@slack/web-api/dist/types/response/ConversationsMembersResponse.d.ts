import type { WebAPICallResult } from '../../WebClient';
export type ConversationsMembersResponse = WebAPICallResult & {
    error?: string;
    members?: string[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    next_cursor?: string;
}
//# sourceMappingURL=ConversationsMembersResponse.d.ts.map