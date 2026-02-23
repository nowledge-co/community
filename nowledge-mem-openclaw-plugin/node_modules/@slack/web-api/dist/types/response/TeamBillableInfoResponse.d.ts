import type { WebAPICallResult } from '../../WebClient';
export type TeamBillableInfoResponse = WebAPICallResult & {
    billable_info?: {
        [key: string]: BillableInfo;
    };
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface BillableInfo {
    billing_active?: boolean;
}
export interface ResponseMetadata {
    next_cursor?: string;
}
//# sourceMappingURL=TeamBillableInfoResponse.d.ts.map