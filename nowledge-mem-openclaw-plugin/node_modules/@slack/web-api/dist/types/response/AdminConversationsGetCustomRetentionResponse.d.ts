import type { WebAPICallResult } from '../../WebClient';
export type AdminConversationsGetCustomRetentionResponse = WebAPICallResult & {
    duration_days?: number;
    error?: string;
    is_policy_enabled?: boolean;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=AdminConversationsGetCustomRetentionResponse.d.ts.map