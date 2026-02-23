import type { WebAPICallResult } from '../../WebClient';
export type TeamProfileGetResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    profile?: Profile;
    provided?: string;
};
export interface Profile {
    fields?: Field[];
    sections?: Section[];
}
export interface Field {
    field_name?: string;
    hint?: string;
    id?: string;
    is_hidden?: boolean;
    is_inverse?: boolean;
    label?: string;
    options?: Options;
    ordering?: number;
    permissions?: Permissions;
    possible_values?: string[];
    section_id?: string;
    type?: string;
}
export interface Options {
    is_protected?: boolean;
    is_scim?: boolean;
}
export interface Permissions {
    api?: string[];
    scim?: boolean;
    ui?: boolean;
}
export interface Section {
    id?: string;
    is_hidden?: boolean;
    label?: string;
    order?: number;
    section_type?: string;
    team_id?: string;
}
//# sourceMappingURL=TeamProfileGetResponse.d.ts.map