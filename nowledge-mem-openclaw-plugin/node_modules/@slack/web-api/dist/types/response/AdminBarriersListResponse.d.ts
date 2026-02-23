import type { WebAPICallResult } from '../../WebClient';
export type AdminBarriersListResponse = WebAPICallResult & {
    barriers?: Barrier[];
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export interface Barrier {
    barriered_from_usergroups?: Usergroup[];
    date_update?: number;
    enterprise_id?: string;
    id?: string;
    primary_usergroup?: Usergroup;
    restricted_subjects?: string[];
}
export interface Usergroup {
    id?: string;
    name?: string;
}
//# sourceMappingURL=AdminBarriersListResponse.d.ts.map