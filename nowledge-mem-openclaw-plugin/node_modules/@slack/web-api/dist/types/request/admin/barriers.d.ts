import type { OptionalArgument } from '../../helpers';
import type { CursorPaginationEnabled, TokenOverridable } from '../common';
interface BarrierID {
    /** @description The ID of the barrier. */
    barrier_id: string;
}
export interface AdminBarriersCreateArguments extends TokenOverridable {
    /** @description A list of {@link https://slack.com/help/articles/115001435788-Connect-identity-provider-groups-to-your-Enterprise-Grid-org IDP Groups} IDs ti associate with the barrier. */
    barriered_from_usergroup_ids: string[];
    /** @description The ID of the primary {@link https://slack.com/help/articles/115001435788-Connect-identity-provider-groups-to-your-Enterprise-Grid-org IDP Group}. */
    primary_usergroup_id: string;
    /**
     * @description What kind of interactions are blocked by this barrier?
     * Currently you must provide all three: `im`, `mpim`, `call`.
     */
    restricted_subjects: ['im', 'mpim', 'call'];
}
export interface AdminBarriersDeleteArguments extends BarrierID, TokenOverridable {
}
export type AdminBarriersListArguments = OptionalArgument<TokenOverridable & CursorPaginationEnabled>;
export interface AdminBarriersUpdateArguments extends AdminBarriersCreateArguments, BarrierID {
}
export {};
//# sourceMappingURL=barriers.d.ts.map