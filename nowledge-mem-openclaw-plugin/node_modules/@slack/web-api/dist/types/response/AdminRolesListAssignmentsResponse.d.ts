import type { WebAPICallResult } from '../../WebClient';
export type AdminRolesListAssignmentsResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    role_assignments?: RoleAssignment[];
};
export interface ResponseMetadata {
    messages?: string[];
    next_cursor?: string;
}
export interface RoleAssignment {
    date_create?: number;
    entity_id?: string;
    role_id?: string;
    user_id?: string;
}
//# sourceMappingURL=AdminRolesListAssignmentsResponse.d.ts.map