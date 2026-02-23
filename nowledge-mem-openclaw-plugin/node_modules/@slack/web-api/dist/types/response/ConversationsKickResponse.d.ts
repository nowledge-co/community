import type { WebAPICallResult } from '../../WebClient';
export type ConversationsKickResponse = WebAPICallResult & {
    error?: string;
    errors?: Errors;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export type Errors = {};
//# sourceMappingURL=ConversationsKickResponse.d.ts.map