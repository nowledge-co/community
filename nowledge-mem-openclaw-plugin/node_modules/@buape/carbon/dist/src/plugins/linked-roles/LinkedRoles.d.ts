import { Plugin } from "../../abstracts/Plugin.js";
import type { Client } from "../../classes/Client.js";
import { type LinkedRolesOptions } from "./types.js";
declare module "../../classes/Client.d.ts" {
    interface ClientOptions {
        /**
         * The client secret of the app, used for OAuth
         */
        clientSecret: string;
    }
}
/**
 * This class is the main class that is used for the linked roles feature of Carbon.
 * It handles all the additional routes and oauth.
 *
 * @example
 * ```ts
 * import { Client, ApplicationRoleConnectionMetadataType } from "@buape/carbon"
 * import { LinkedRoles } from "@buape/carbon/linked-roles"
 *
 * const linkedRoles = new LinkedRoles({
 *   metadata: [
 * 	   {
 * 		   key: "is_staff",
 * 		   name: "Verified Staff",
 * 		   description: "Whether the user is a verified staff member",
 * 		   type: ApplicationRoleConnectionMetadataType.BooleanEqual
 * 	   }
 *   ],
 *   metadataCheckers: {
 *     is_staff: async (userId) => {
 *       const allStaff = ["439223656200273932"]
 *       return allStaff.includes(userId)
 *     }
 *   }
 * })
 *
 * const client = new Client({ ...  }, [ ... ], [linkedRoles])
 * ```
 */
export declare class LinkedRoles extends Plugin {
    readonly id = "linked-roles";
    client?: Client;
    options: LinkedRolesOptions;
    constructor(options: LinkedRolesOptions);
    registerClient(client: Client): void;
    registerRoutes(client: Client): void;
    private assertRegistered;
    /**
     * Handle a request to deploy the linked roles to Discord
     * @returns A response
     */
    handleDeployRequest(): Promise<Response>;
    /**
     * Handle the verify user request
     * @returns A response
     */
    handleUserVerificationRequest(): Promise<Response>;
    /**
     * Handle the verify user callback request
     * @param req The request
     * @returns A response
     */
    handleUserVerificationCallbackRequest(req: Request): Promise<Response>;
    private getMetadataFromCheckers;
    private getOAuthTokens;
    private updateMetadata;
    private setMetadata;
}
//# sourceMappingURL=LinkedRoles.d.ts.map