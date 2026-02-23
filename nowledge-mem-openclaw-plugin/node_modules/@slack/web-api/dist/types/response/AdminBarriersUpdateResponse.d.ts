import type { WebAPICallResult } from '../../WebClient';
export type AdminBarriersUpdateResponse = WebAPICallResult & {
    barrier?: Barrier;
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
//# sourceMappingURL=AdminBarriersUpdateResponse.d.ts.map