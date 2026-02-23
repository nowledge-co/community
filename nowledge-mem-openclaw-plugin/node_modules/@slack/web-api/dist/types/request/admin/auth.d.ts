import type { CursorPaginationEnabled, TokenOverridable } from '../common';
interface EntityIDs {
    /** @description Encoded IDs of the entities interacting with. */
    entity_ids: string[];
}
interface EntityType {
    /** @description The type of entity interacting with the policy. */
    entity_type: 'USER';
}
interface PolicyName {
    /** @description The name of the policy. */
    policy_name: 'email_password';
}
export interface AdminAuthPolicyAssignEntitiesArguments extends EntityIDs, EntityType, PolicyName, TokenOverridable {
}
export interface AdminAuthPolicyGetEntitiesArguments extends Partial<EntityType>, PolicyName, TokenOverridable, CursorPaginationEnabled {
}
export interface AdminAuthPolicyRemoveEntitiesArguments extends EntityIDs, EntityType, PolicyName, TokenOverridable {
}
export {};
//# sourceMappingURL=auth.d.ts.map