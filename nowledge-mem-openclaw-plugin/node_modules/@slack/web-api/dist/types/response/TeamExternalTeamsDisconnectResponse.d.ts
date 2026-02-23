import type { WebAPICallResult } from '../../WebClient';
export type TeamExternalTeamsDisconnectResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=TeamExternalTeamsDisconnectResponse.d.ts.map