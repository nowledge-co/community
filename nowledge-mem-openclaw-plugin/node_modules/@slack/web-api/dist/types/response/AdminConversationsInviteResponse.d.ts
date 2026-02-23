import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsInviteResponse = WebAPICallResult & {
    error?: string;
    failed_user_ids?: FailedUserids;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export interface FailedUserids {
    U00000000?: string;
    U00000001?: string;
}
//# sourceMappingURL=AdminConversationsInviteResponse.d.ts.map