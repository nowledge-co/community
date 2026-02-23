import type { WebAPICallResult } from '../../WebClient';
export type ConversationsAcceptSharedInviteResponse = WebAPICallResult & {
    can_open_scdm?: boolean;
    channel_id?: string;
    error?: string;
    implicit_approval?: boolean;
    invite_id?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=ConversationsAcceptSharedInviteResponse.d.ts.map