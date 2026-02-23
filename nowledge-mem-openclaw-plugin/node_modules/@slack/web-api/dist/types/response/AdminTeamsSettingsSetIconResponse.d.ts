import type { WebAPICallResult } from '../../WebClient';
export type AdminTeamsSettingsSetIconResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminTeamsSettingsSetIconResponse.d.ts.map