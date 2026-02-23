import type { WebAPICallResult } from '../../WebClient';
export type ChatScheduledMessagesListResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    scheduled_messages?: ScheduledMessage[];
};
export interface ResponseMetadata {
    next_cursor?: string;
}
export interface ScheduledMessage {
    channel_id?: string;
    date_created?: number;
    id?: string;
    post_at?: number;
    text?: string;
}
//# sourceMappingURL=ChatScheduledMessagesListResponse.d.ts.map