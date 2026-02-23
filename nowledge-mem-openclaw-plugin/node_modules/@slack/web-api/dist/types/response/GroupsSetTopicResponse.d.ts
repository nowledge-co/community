import type { WebAPICallResult } from '../../WebClient';
export type GroupsSetTopicResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    topic?: string;
    warning?: string;
};
export interface ResponseMetadata {
    messages?: string[];
    warnings?: string[];
}
//# sourceMappingURL=GroupsSetTopicResponse.d.ts.map