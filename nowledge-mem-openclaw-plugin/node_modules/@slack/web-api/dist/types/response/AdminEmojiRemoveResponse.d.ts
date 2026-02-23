import type { WebAPICallResult } from '../../WebClient';
export type AdminEmojiRemoveResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminEmojiRemoveResponse.d.ts.map