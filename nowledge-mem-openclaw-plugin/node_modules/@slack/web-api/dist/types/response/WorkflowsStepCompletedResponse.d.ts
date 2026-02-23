import type { WebAPICallResult } from '../../WebClient';
export type WorkflowsStepCompletedResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=WorkflowsStepCompletedResponse.d.ts.map