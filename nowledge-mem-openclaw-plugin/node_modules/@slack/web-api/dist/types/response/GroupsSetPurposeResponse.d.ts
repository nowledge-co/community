import type { WebAPICallResult } from '../../WebClient';
export type GroupsSetPurposeResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    purpose?: string;
    response_metadata?: ResponseMetadata;
    warning?: string;
};
export interface ResponseMetadata {
    messages?: string[];
    warnings?: string[];
}
//# sourceMappingURL=GroupsSetPurposeResponse.d.ts.map