import type { WebAPICallResult } from '../../WebClient';
export type AdminWorkflowsPermissionsLookupResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    permissions?: {
        [key: string]: Permission;
    };
    provided?: string;
};
export interface Permission {
    complete?: boolean;
    who_can_run?: WhoCanRun;
}
export interface WhoCanRun {
    channel_ids?: string[];
    org_ids?: string[];
    permission_type?: string;
    team_ids?: string[];
    user_ids?: string[];
}
//# sourceMappingURL=AdminWorkflowsPermissionsLookupResponse.d.ts.map