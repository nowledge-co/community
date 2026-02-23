import type { WebAPICallResult } from '../../WebClient';
export type AdminUsersSessionGetSettingsResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    no_settings_applied?: string[];
    ok?: boolean;
    provided?: string;
    session_settings?: SessionSetting[];
};
export interface SessionSetting {
    desktop_app_browser_quit?: boolean;
    duration?: number;
    user_id?: string;
}
//# sourceMappingURL=AdminUsersSessionGetSettingsResponse.d.ts.map