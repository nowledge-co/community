import type { WebAPICallResult } from '../../WebClient';
export type ConversationsCanvasesCreateResponse = WebAPICallResult & {
    canvas_id?: string;
    detail?: string;
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=ConversationsCanvasesCreateResponse.d.ts.map