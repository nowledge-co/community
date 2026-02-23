import type { OAuthCredentials, OAuthGrantRefresh } from './common';
export interface OAuthAccessArguments extends OAuthCredentials {
    /** @description Request the user to add your app only to a single channel. Only valid with a {@link https://docs.slack.dev/legacy/legacy-steps-from-apps legacy workspace app}. Defaults to `false`. */
    single_channel?: boolean;
}
export interface OAuthV2AccessArguments extends OAuthCredentials, OAuthGrantRefresh {
}
export interface OAuthV2ExchangeArguments extends Pick<OAuthCredentials, 'client_id' | 'client_secret'> {
    /** @description The legacy xoxb or xoxp token being migrated. */
    token: string;
}
//# sourceMappingURL=oauth.d.ts.map