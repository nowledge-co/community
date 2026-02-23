import type { Stream } from 'node:stream';
import type { CursorPaginationEnabled, LocaleAware, OptionalTeamAssignable, TokenOverridable } from './common';
interface Email {
    /** @description An email address belonging to a user in the workspace */
    email: string;
}
export interface UsersConversationsArguments extends TokenOverridable, CursorPaginationEnabled, OptionalTeamAssignable {
    /** @description Set to `true` to exclude archived channels from the list. Default is `false`. */
    exclude_archived?: boolean;
    /**
     * @description Mix and match channel types by providing a comma-separated list of any combination of
     * `public_channel`, `private_channel`, `mpim` and `im`. Defaults to `public_channel`.
     */
    types?: string;
    /**
     * @description Browse conversations by a specific user ID's membership.
     * Non-public channels are restricted to those where the calling user shares membership.
     */
    user?: string;
}
export interface UsersDeletePhotoArguments extends TokenOverridable {
}
export interface UsersDiscoverableContactsLookupArguments extends Email, TokenOverridable {
}
export interface UsersGetPresenceArguments extends TokenOverridable {
    /** @description User to get presence info on. Defaults to the authed user. */
    user?: string;
}
export interface UsersIdentityArguments extends TokenOverridable {
}
export interface UsersInfoArguments extends TokenOverridable, LocaleAware {
    /** @description User to get info on. */
    user: string;
}
export interface UsersListArguments extends TokenOverridable, CursorPaginationEnabled, LocaleAware, OptionalTeamAssignable {
}
export interface UsersLookupByEmailArguments extends Email, TokenOverridable {
}
export interface UsersSetPhotoArguments extends TokenOverridable {
    /** @description Image file contents. */
    image: Buffer | Stream;
    /** @description Width/height of crop box (always square). */
    crop_w?: number;
    /** @description X coordinate of top-left corner of crop box. */
    crop_x?: number;
    /** @description Y coordinate of top-left corner of crop box. */
    crop_y?: number;
}
export interface UsersSetPresenceArguments extends TokenOverridable {
    /** @description Either `auto` or `away`. */
    presence: 'auto' | 'away';
}
export interface UsersProfileGetArguments extends TokenOverridable {
    /**
     * @description Include labels for each ID in custom profile fields.
     * Using this parameter will heavily rate-limit your requests and is not recommended. Defaults to `false`.
     */
    include_labels?: boolean;
    /** @description User to retrieve profile info for. */
    user?: string;
}
export interface UsersProfileSetArguments extends TokenOverridable {
    /**
     * @description Sets profile fields using a single argument.
     * Collection of key:value pairs presented.
     * At most 50 fields may be set. Each field name is limited to 255 characters.
     * @see {@link https://docs.slack.dev/reference/methods/users.profile.set#profile-fields `users.profile.set` Profile fields usage info}.
     */
    profile?: Record<string, unknown>;
    /** @description ID of user to change. This argument may only be specified by admins on paid teams. */
    user?: string;
    /**
     * @description Name of a single profile field to set. If both `name` and `profile` are set, `name` takes precedence.
     * @see {@link https://docs.slack.dev/reference/methods/users.profile.set#profile-fields `users.profile.set` Profile fields usage info}.
     */
    name?: string;
    /**
     * @description Value to set for the profile field specified by `name`. Usable only if profile is not passed.
     * @see {@link https://docs.slack.dev/reference/methods/users.profile.set#profile-fields `users.profile.set` Profile fields usage info}.
     */
    value?: string;
}
export {};
//# sourceMappingURL=users.d.ts.map