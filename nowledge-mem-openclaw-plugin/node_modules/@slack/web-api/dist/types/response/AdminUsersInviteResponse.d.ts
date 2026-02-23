import type { WebAPICallResult } from '../../WebClient';
export type AdminUsersInviteResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminUsersInviteResponse.d.ts.map