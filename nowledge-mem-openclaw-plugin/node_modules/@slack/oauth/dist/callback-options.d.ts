import type { IncomingMessage, ServerResponse } from 'node:http';
import { type CodedError } from './errors';
import type { InstallURLOptions } from './install-url-options';
import type { Installation, OrgInstallation } from './installation';
export interface CallbackOptions {
    /**
     * An additional logic to run right before executing the Slack app installation with the given OAuth code parameter.
     *
     * When this method returns false, the InstallProvider skips the installation.
     * You can set false when the visiting user is not eligible to proceed with the Slack app installation flow.
     *
     * Also, when returning false, this method is responsible for calling the callbackRes#end() method
     * to build a complete HTTP response for end-users.
     */
    beforeInstallation?: (options: InstallURLOptions, callbackReq: IncomingMessage, callbackRes: ServerResponse) => Promise<boolean>;
    /**
     * An additional logic to run right after executing the Slack app installation with the given OAuth code parameter.
     *
     * When this method returns false, the InstallProvider skips storing the installation in database.
     * You can set false when your app needs to cancel the installation (you can call auth.revoke API method for it)
     * and then, the app needs to display an error page to the installing user.
     *
     * Also, when returning false, this method is responsible to call callbackRes#end() method
     * to build complete HTTP response for end-users.
     */
    afterInstallation?: (installation: Installation | OrgInstallation, options: InstallURLOptions, callbackReq: IncomingMessage, callbackRes: ServerResponse) => Promise<boolean>;
    success?: (installation: Installation | OrgInstallation, options: InstallURLOptions, callbackReq: IncomingMessage, callbackRes: ServerResponse) => void;
    successAsync?: (installation: Installation | OrgInstallation, options: InstallURLOptions, callbackReq: IncomingMessage, callbackRes: ServerResponse) => Promise<void>;
    failure?: (error: CodedError, options: InstallURLOptions, callbackReq: IncomingMessage, callbackRes: ServerResponse) => void;
    failureAsync?: (error: CodedError, options: InstallURLOptions, callbackReq: IncomingMessage, callbackRes: ServerResponse) => Promise<void>;
}
export declare function defaultCallbackSuccess(installation: Installation, _options: InstallURLOptions | undefined, _req: IncomingMessage, res: ServerResponse): void;
export declare function defaultCallbackFailure(error: CodedError, _options: InstallURLOptions, _req: IncomingMessage, res: ServerResponse): void;
export declare function escapeHtml(input: string | undefined | null): string;
//# sourceMappingURL=callback-options.d.ts.map