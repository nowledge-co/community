import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsWhitelistAddResponse = WebAPICallResult & {
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
//# sourceMappingURL=AdminConversationsWhitelistAddResponse.d.ts.map