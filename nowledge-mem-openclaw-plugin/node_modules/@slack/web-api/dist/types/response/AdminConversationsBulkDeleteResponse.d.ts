import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsBulkDeleteResponse = WebAPICallResult & {
    bulk_action_id?: string;
    error?: string;
    needed?: string;
    not_added?: NotAdded[];
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface NotAdded {
    channel_id?: string;
    errors?: string[];
}
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminConversationsBulkDeleteResponse.d.ts.map