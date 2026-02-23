import type { WebAPICallResult } from '../../WebClient';
export type RemindersListResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    reminders?: Reminder[];
};
export interface Reminder {
    channel?: string;
    complete_ts?: number;
    creator?: string;
    id?: string;
    recurrence?: Recurrence;
    recurring?: boolean;
    text?: string;
    time?: number;
    user?: string;
}
export interface Recurrence {
    frequency?: string;
    weekdays?: string[];
}
//# sourceMappingURL=RemindersListResponse.d.ts.map