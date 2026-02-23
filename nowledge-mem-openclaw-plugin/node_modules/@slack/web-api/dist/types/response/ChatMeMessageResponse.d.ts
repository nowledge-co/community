import type { WebAPICallResult } from '../../WebClient';
export type ChatMeMessageResponse = WebAPICallResult & {
    channel?: string;
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    ts?: string;
};
//# sourceMappingURL=ChatMeMessageResponse.d.ts.map