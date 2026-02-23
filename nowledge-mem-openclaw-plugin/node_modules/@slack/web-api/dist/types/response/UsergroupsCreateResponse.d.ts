import type { WebAPICallResult } from '../../WebClient';
export type UsergroupsCreateResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    usergroup?: Usergroup;
};
export interface Usergroup {
    auto_provision?: boolean;
    channel_count?: number;
    created_by?: string;
    date_create?: number;
    date_delete?: number;
    date_update?: number;
    description?: string;
    enterprise_subteam_id?: string;
    handle?: string;
    id?: string;
    is_external?: boolean;
    is_section?: boolean;
    is_subteam?: boolean;
    is_usergroup?: boolean;
    name?: string;
    prefs?: Prefs;
    team_id?: string;
    updated_by?: string;
    users?: string[];
}
export interface Prefs {
    channels?: string[];
    groups?: string[];
}
//# sourceMappingURL=UsergroupsCreateResponse.d.ts.map