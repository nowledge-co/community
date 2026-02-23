import type { WebAPICallResult } from '../../WebClient';
export type AppsEventAuthorizationsListResponse = WebAPICallResult & {
    authorizations?: Authorization[];
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export interface Authorization {
    enterprise_id?: string;
    is_bot?: boolean;
    is_enterprise_install?: boolean;
    team_id?: string;
    user_id?: string;
}
//# sourceMappingURL=AppsEventAuthorizationsListResponse.d.ts.map