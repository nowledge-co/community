import type { WebAPICallResult } from '../../WebClient';
export type TeamBillingInfoResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    plan?: string;
    provided?: string;
};
//# sourceMappingURL=TeamBillingInfoResponse.d.ts.map