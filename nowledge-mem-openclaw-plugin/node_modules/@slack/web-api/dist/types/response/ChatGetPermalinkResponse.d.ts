import type { WebAPICallResult } from '../../WebClient';
export type ChatGetPermalinkResponse = WebAPICallResult & {
    channel?: string;
    error?: string;
    needed?: string;
    ok?: boolean;
    permalink?: string;
    provided?: string;
};
//# sourceMappingURL=ChatGetPermalinkResponse.d.ts.map