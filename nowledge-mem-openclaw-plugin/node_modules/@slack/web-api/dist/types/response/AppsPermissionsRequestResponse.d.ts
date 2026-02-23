import type { WebAPICallResult } from '../../WebClient';
export type AppsPermissionsRequestResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=AppsPermissionsRequestResponse.d.ts.map