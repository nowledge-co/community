import type { OptionalArgument } from '../helpers';
import type { CursorPaginationEnabled, TokenOverridable } from './common';
export type AuthRevokeArguments = OptionalArgument<TokenOverridable & {
    /**
     * @description Setting this parameter to `true` triggers a testing mode where the specified token
     * will not actually be revoked.
     */
    test?: boolean;
}>;
export type AuthTeamsListArguments = OptionalArgument<TokenOverridable & CursorPaginationEnabled & {
    /**
     * @description Whether to return icon paths for each workspace.
     * An icon path represents a URI pointing to the image signifying the workspace.
     * Defaults to `false`.
     */
    include_icon?: boolean;
}>;
export type AuthTestArguments = OptionalArgument<TokenOverridable>;
//# sourceMappingURL=auth.d.ts.map