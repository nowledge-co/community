import type { WebAPICallResult } from '../../WebClient';
export type CanvasesCreateResponse = WebAPICallResult & {
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
//# sourceMappingURL=CanvasesCreateResponse.d.ts.map