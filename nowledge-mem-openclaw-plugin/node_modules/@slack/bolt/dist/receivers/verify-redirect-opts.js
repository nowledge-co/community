"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRedirectOpts = void 0;
/**
 * Helper to verify redirect uri and redirect uri path exist and are consistent
 * when supplied.
 */
const errors_1 = require("../errors");
function verifyRedirectOpts({ redirectUri, redirectUriPath }) {
    // if redirectUri is supplied, redirectUriPath is required
    if (redirectUri && !redirectUriPath) {
        throw new errors_1.AppInitializationError(' You have set a redirectUri but not a matching redirectUriPath.' +
            ' Please provide this via installerOptions.redirectUriPath' +
            ' Note: These should be consistent, e.g. https://example.com/redirect and /redirect');
    }
    // if both redirectUri and redirectUri are supplied, they must be consistent
    if (redirectUri && redirectUriPath && !redirectUri?.endsWith(redirectUriPath)) {
        throw new errors_1.AppInitializationError('redirectUri and installerOptions.redirectUriPath should be consistent' +
            ' e.g. https://example.com/redirect and /redirect');
    }
}
exports.verifyRedirectOpts = verifyRedirectOpts;
//# sourceMappingURL=verify-redirect-opts.js.map