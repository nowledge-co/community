import type { WebAPICallResult } from '../../WebClient';
export type AppsPermissionsInfoResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=AppsPermissionsInfoResponse.d.ts.map