import type { HTTPReceiverInstallerOptions, HTTPReceiverOptions } from './HTTPReceiver';
export interface RedirectOptions {
    redirectUri?: HTTPReceiverOptions['redirectUri'];
    redirectUriPath?: HTTPReceiverInstallerOptions['redirectUriPath'];
}
export declare function verifyRedirectOpts({ redirectUri, redirectUriPath }: RedirectOptions): void;
//# sourceMappingURL=verify-redirect-opts.d.ts.map