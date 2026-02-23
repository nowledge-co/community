import type { WebAPICallResult } from '../../WebClient';
export type AdminTeamsCreateResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    team?: string;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminTeamsCreateResponse.d.ts.map