import type { WebAPICallResult } from '../../WebClient';
export type ApiTestResponse = WebAPICallResult & {
    args?: Args;
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export interface Args {
    error?: string;
    foo?: string;
}
//# sourceMappingURL=ApiTestResponse.d.ts.map