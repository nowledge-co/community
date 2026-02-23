import type { WebAPICallResult } from '../../WebClient';
export type BookmarksRemoveResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=BookmarksRemoveResponse.d.ts.map