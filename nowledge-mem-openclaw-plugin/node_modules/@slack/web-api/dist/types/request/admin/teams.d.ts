import type { OptionalArgument } from '../../helpers';
import type { ChannelIDs, CursorPaginationEnabled, TeamID, TokenOverridable } from '../common';
type TeamDiscoverability = 'open' | 'closed' | 'invite_only' | 'unlisted';
export interface AdminTeamsAdminsListArguments extends TeamID, TokenOverridable, CursorPaginationEnabled {
}
export interface AdminTeamsCreateArguments extends TokenOverridable {
    /** @description Team domain (for example, slacksoftballteam). Domains are limited to 21 characters. */
    team_domain: string;
    /** @description Team name (for example, Slack Softball Team). */
    team_name: string;
    /** @description Description for the team. */
    team_description?: string;
    /** @description Who can join the team. */
    team_discoverability?: TeamDiscoverability;
}
export type AdminTeamsListArguments = OptionalArgument<TokenOverridable & CursorPaginationEnabled>;
export interface AdminTeamsOwnersListArguments extends TeamID, TokenOverridable, CursorPaginationEnabled {
}
export interface AdminTeamsSettingsInfoArguments extends TeamID, TokenOverridable {
}
export interface AdminTeamsSettingsSetDefaultChannelsArguments extends ChannelIDs, TeamID, TokenOverridable {
}
export interface AdminTeamsSettingsSetDescriptionArguments extends TeamID, TokenOverridable {
    /** @description The new description for the workspace. */
    description: string;
}
export interface AdminTeamsSettingsSetDiscoverabilityArguments extends TeamID, TokenOverridable {
    /** @description This workspace's discovery setting. */
    discoverability: TeamDiscoverability;
}
export interface AdminTeamsSettingsSetIconArguments extends TeamID, TokenOverridable {
    /** @description Image URL for the icon. */
    image_url: string;
}
export interface AdminTeamsSettingsSetNameArguments extends TeamID, TokenOverridable {
    /** @description The new name of the workspace. */
    name: string;
}
export {};
//# sourceMappingURL=teams.d.ts.map