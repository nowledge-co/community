import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsConvertToPublicResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminConversationsConvertToPublicResponse.d.ts.map