import type { WebAPICallResult } from '../../WebClient';
export type AdminAuthPolicyGetEntitiesResponse = WebAPICallResult & {
    entities?: Entity[];
    entity_total_count?: number;
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export interface Entity {
    date_added?: number;
    entity_id?: string;
    entity_type?: string;
}
//# sourceMappingURL=AdminAuthPolicyGetEntitiesResponse.d.ts.map