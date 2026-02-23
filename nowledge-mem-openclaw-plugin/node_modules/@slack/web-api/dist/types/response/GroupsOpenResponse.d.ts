import type { WebAPICallResult } from '../../WebClient';
export type GroupsOpenResponse = WebAPICallResult & {
    already_open?: boolean;
    error?: string;
    needed?: string;
    no_op?: boolean;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    warning?: string;
};
export interface ResponseMetadata {
    messages?: string[];
    warnings?: string[];
}
//# sourceMappingURL=GroupsOpenResponse.d.ts.map