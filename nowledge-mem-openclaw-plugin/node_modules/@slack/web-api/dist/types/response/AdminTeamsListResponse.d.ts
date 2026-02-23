import type { WebAPICallResult } from '../../WebClient';
export type AdminTeamsListResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    teams?: Team[];
};
export interface ResponseMetadata {
    next_cursor?: string;
}
export interface Team {
    discoverability?: string;
    id?: string;
    name?: string;
    primary_owner?: PrimaryOwner;
    team_url?: string;
}
export interface PrimaryOwner {
    email?: string;
    user_id?: string;
}
//# sourceMappingURL=AdminTeamsListResponse.d.ts.map