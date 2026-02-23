import type { WebAPICallResult } from '../../WebClient';
export type UsersIdentityResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    team?: Team;
    user?: User;
    warning?: string;
};
export interface Team {
    id?: string;
    name?: string;
}
export interface User {
    email?: string;
    id?: string;
    image_192?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_512?: string;
    image_72?: string;
    name?: string;
}
//# sourceMappingURL=UsersIdentityResponse.d.ts.map