import type { WebAPICallResult } from '../../WebClient';
export type AdminAppsRestrictResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    warning?: string;
};
//# sourceMappingURL=AdminAppsRestrictResponse.d.ts.map