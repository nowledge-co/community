import type { WebAPICallResult } from '../../WebClient';
export type WorkflowsStepFailedResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=WorkflowsStepFailedResponse.d.ts.map