import type { OptionalArgument } from '../helpers';
import type { OAuthCredentials, OAuthGrantRefresh } from './common';
export interface OpenIDConnectTokenArguments extends OAuthCredentials, OAuthGrantRefresh {
}
export type OpenIDConnectUserInfoArguments = OptionalArgument<object>;
//# sourceMappingURL=openid.d.ts.map