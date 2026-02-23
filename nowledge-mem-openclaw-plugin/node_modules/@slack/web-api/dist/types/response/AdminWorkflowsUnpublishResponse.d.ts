import type { WebAPICallResult } from '../../WebClient';
export type AdminWorkflowsUnpublishResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminWorkflowsUnpublishResponse.d.ts.map