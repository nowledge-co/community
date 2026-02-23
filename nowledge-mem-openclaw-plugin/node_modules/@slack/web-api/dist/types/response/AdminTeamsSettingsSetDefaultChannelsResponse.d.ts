import type { WebAPICallResult } from '../../WebClient';
export type AdminTeamsSettingsSetDefaultChannelsResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminTeamsSettingsSetDefaultChannelsResponse.d.ts.map