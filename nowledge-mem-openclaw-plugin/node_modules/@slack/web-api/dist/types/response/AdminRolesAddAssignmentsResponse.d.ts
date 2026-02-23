import type { WebAPICallResult } from '../../WebClient';
export type AdminRolesAddAssignmentsResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    rejected_users?: RejectedUser[];
};
export interface RejectedUser {
    error?: string;
    id?: string;
}
//# sourceMappingURL=AdminRolesAddAssignmentsResponse.d.ts.map