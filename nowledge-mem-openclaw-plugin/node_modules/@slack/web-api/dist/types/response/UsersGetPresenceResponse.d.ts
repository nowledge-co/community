import type { WebAPICallResult } from '../../WebClient';
export type UsersGetPresenceResponse = WebAPICallResult & {
    auto_away?: boolean;
    connection_count?: number;
    error?: string;
    last_activity?: number;
    manual_away?: boolean;
    needed?: string;
    ok?: boolean;
    online?: boolean;
    presence?: string;
    provided?: string;
    warning?: string;
};
//# sourceMappingURL=UsersGetPresenceResponse.d.ts.map