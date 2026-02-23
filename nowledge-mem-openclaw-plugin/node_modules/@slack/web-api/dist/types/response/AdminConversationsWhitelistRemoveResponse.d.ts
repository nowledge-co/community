import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsWhitelistRemoveResponse = WebAPICallResult & {
    error?: string;
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
//# sourceMappingURL=AdminConversationsWhitelistRemoveResponse.d.ts.map