import type { WebAPICallResult } from '../../WebClient';
export type AdminEmojiRenameResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminEmojiRenameResponse.d.ts.map