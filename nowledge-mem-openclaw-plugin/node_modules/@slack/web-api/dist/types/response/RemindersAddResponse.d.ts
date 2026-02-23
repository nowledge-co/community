import type { WebAPICallResult } from '../../WebClient';
export type RemindersAddResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    reminder?: Reminder;
    response_metadata?: ResponseMetadata;
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
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=RemindersAddResponse.d.ts.map