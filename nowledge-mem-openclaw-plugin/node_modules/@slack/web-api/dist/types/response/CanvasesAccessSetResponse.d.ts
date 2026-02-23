import type { WebAPICallResult } from '../../WebClient';
export type CanvasesAccessSetResponse = WebAPICallResult & {
    error?: string;
    failed_to_update_channel_ids?: string[];
    failed_to_update_user_ids?: string[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export type ResponseMetadata = {};
//# sourceMappingURL=CanvasesAccessSetResponse.d.ts.map