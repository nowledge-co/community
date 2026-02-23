import type { WebAPICallResult } from '../../WebClient';
export type ConversationsCloseResponse = WebAPICallResult & {
    already_closed?: boolean;
    error?: string;
    needed?: string;
    no_op?: boolean;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=ConversationsCloseResponse.d.ts.map