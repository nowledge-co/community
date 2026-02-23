import type { WebAPICallResult } from '../../WebClient';
export type GroupsMarkResponse = WebAPICallResult & {
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
//# sourceMappingURL=GroupsMarkResponse.d.ts.map