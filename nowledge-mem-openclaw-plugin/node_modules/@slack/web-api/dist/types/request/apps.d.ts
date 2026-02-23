import type { OptionalArgument } from '../helpers';
import type { AppID, CursorPaginationEnabled, OAuthCredentials, TokenOverridable } from './common';
import type { Manifest } from './manifest';
export type AppsConnectionsOpenArguments = OptionalArgument<object>;
export interface AppsEventAuthorizationsListArguments extends TokenOverridable, CursorPaginationEnabled {
    event_context: string;
}
export interface AppsManifestCreateArguments extends TokenOverridable {
    manifest: Manifest;
}
export interface AppsManifestDeleteArguments extends AppID, TokenOverridable {
}
export interface AppsManifestExportArguments extends AppID, TokenOverridable {
}
export interface AppsManifestUpdateArguments extends AppID, TokenOverridable {
    manifest: Manifest;
}
export interface AppsManifestValidateArguments extends Partial<AppID>, TokenOverridable {
    manifest: Manifest;
}
export interface AppsUninstallArguments extends Pick<OAuthCredentials, 'client_id' | 'client_secret'>, TokenOverridable {
}
//# sourceMappingURL=apps.d.ts.map