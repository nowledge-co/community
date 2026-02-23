import type { WebAPICallResult } from '../../WebClient';
export type ChatDeleteResponse = WebAPICallResult & {
    channel?: string;
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    ts?: string;
};
//# sourceMappingURL=ChatDeleteResponse.d.ts.map