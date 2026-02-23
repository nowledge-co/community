import type { WebAPICallResult } from '../../WebClient';
export type AdminBarriersCreateResponse = WebAPICallResult & {
    barrier?: Barrier;
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
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
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminBarriersCreateResponse.d.ts.map