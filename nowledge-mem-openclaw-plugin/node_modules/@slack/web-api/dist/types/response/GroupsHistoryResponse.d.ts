import type { WebAPICallResult } from '../../WebClient';
export type GroupsHistoryResponse = WebAPICallResult & {
    channel_actions_count?: number;
    error?: string;
    has_more?: boolean;
    messages?: Message[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    warning?: string;
};
export interface Message {
    subtype?: string;
    text?: string;
    ts?: string;
    type?: string;
    user?: string;
}
export interface ResponseMetadata {
    messages?: string[];
    warnings?: string[];
}
//# sourceMappingURL=GroupsHistoryResponse.d.ts.map