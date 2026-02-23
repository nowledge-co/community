import type { WebAPICallResult } from '../../WebClient';
export type ConversationsInviteSharedResponse = WebAPICallResult & {
    conf_code?: string;
    error?: string;
    invite_id?: string;
    is_legacy_shared_channel?: boolean;
    needed?: string;
    ok?: boolean;
    provided?: string;
    url?: string;
};
//# sourceMappingURL=ConversationsInviteSharedResponse.d.ts.map