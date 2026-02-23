import type { WebAPICallResult } from '../../WebClient';
export type FunctionsCompleteErrorResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=FunctionsCompleteErrorResponse.d.ts.map