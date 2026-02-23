import type { WebAPICallResult } from '../../WebClient';
export type CallsAddResponse = WebAPICallResult & {
    call?: Call;
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface Call {
    date_start?: number;
    desktop_app_join_url?: string;
    external_display_id?: string;
    external_unique_id?: string;
    id?: string;
    join_url?: string;
    title?: string;
    users?: User[];
}
export interface User {
    avatar_url?: string;
    display_name?: string;
    external_id?: string;
    slack_id?: string;
}
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=CallsAddResponse.d.ts.map