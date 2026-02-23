import type { WebAPICallResult } from '../../WebClient';
export type DialogOpenResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    warning?: string;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=DialogOpenResponse.d.ts.map