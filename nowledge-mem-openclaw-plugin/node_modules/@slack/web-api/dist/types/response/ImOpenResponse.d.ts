import type { WebAPICallResult } from '../../WebClient';
export type ImOpenResponse = WebAPICallResult & {
    already_open?: boolean;
    channel?: Channel;
    error?: string;
    needed?: string;
    no_op?: boolean;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    warning?: string;
};
export interface Channel {
    id?: string;
}
export interface ResponseMetadata {
    messages?: string[];
    warnings?: string[];
}
//# sourceMappingURL=ImOpenResponse.d.ts.map