import type { WebAPICallResult } from '../../WebClient';
export type ChatUnfurlResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=ChatUnfurlResponse.d.ts.map