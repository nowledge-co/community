import type { WebAPICallResult } from '../../WebClient';
export type ChatPostEphemeralResponse = WebAPICallResult & {
    error?: string;
    message_ts?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=ChatPostEphemeralResponse.d.ts.map