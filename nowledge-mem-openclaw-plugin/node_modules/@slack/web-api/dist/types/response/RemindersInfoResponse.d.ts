import type { WebAPICallResult } from '../../WebClient';
export type RemindersInfoResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    reminder?: Reminder;
};
export interface Reminder {
    complete_ts?: number;
    creator?: string;
    id?: string;
    recurring?: boolean;
    text?: string;
    time?: number;
    user?: string;
}
//# sourceMappingURL=RemindersInfoResponse.d.ts.map