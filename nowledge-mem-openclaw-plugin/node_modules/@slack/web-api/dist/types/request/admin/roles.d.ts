import type { OptionalArgument } from '../../helpers';
import type { CursorPaginationEnabled, SortDir, TokenOverridable, UserIDs } from '../common';
export interface EntityIDs {
    /**
     * @description List of the entity IDs for which roles will be assigned/listed/removed.
     * These can be Org IDs (E12345), Team IDs (T12345) or Channel IDs (C12345).
     */
    entity_ids: [string, ...string[]];
}
interface RoleID {
    /**
     * @description ID of the role to which users will be assigned/removed.
     * @see {@link https://docs.slack.dev/reference/methods/admin.roles.addAssignments Admin Roles under Usage info}.
     */
    role_id: string;
}
export interface AdminRolesAddAssignmentsArguments extends EntityIDs, RoleID, UserIDs, TokenOverridable {
}
export type AdminRolesListAssignmentsArguments = OptionalArgument<Partial<EntityIDs> & TokenOverridable & CursorPaginationEnabled & SortDir & {
    /**
     * @description Collection of role ids to scope results by.
     * @see {@link https://docs.slack.dev/reference/methods/admin.roles.addAssignments Admin Roles under Usage info}.
     */
    role_ids?: string[];
}>;
export interface AdminRolesRemoveAssignmentsArguments extends EntityIDs, RoleID, UserIDs, TokenOverridable {
}
export {};
//# sourceMappingURL=roles.d.ts.map