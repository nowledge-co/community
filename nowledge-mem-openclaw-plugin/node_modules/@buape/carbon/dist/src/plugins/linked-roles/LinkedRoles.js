import { Plugin } from "../../abstracts/Plugin.js";
import { ApplicationRoleConnectionMetadataType } from "./types.js";
// TODO: IMO, the metadata for this should be handled similarly to the client and its commands
// That is passing an array of connection instances as the second argument to the constructor
// That is, maybe, for another pr though
// TODO: Improve the response messages
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
export class LinkedRoles extends Plugin {
    id = "linked-roles";
    client;
    options;
    constructor(options) {
        super();
        this.options = { ...options };
    }
    registerClient(client) {
        if (!client.options.baseUrl)
            throw new Error("Missing base URL");
        if (!client.options.clientSecret)
            throw new Error("Missing client secret");
        if (!client.options.deploySecret && !this.options.disableDeployRoute)
            throw new Error("Missing deploy secret");
        this.client = client;
    }
    registerRoutes(client) {
        client.routes.push({
            method: "GET",
            path: "/linked-roles/deploy",
            handler: this.handleDeployRequest.bind(this),
            protected: true,
            disabled: this.options.disableDeployRoute
        });
        client.routes.push({
            method: "GET",
            path: "/linked-roles/verify-user",
            handler: this.handleUserVerificationRequest.bind(this),
            disabled: this.options.disableVerifyUserRoute
        });
        client.routes.push({
            method: "GET",
            path: "/linked-roles/verify-user/callback",
            handler: this.handleUserVerificationCallbackRequest.bind(this),
            disabled: this.options.disableVerifyUserCallbackRoute
        });
    }
    assertRegistered() {
        if (!this.client)
            throw new Error("Client not registered");
    }
    /**
     * Handle a request to deploy the linked roles to Discord
     * @returns A response
     */
    async handleDeployRequest() {
        await this.setMetadata(this.options.metadata);
        return new Response("OK", { status: 202 });
    }
    /**
     * Handle the verify user request
     * @returns A response
     */
    async handleUserVerificationRequest() {
        this.assertRegistered();
        return new Response("Found", {
            status: 302,
            headers: {
                Location: `https://discord.com/oauth2/authorize?client_id=${this.client.options.clientId}&redirect_uri=${encodeURIComponent(`${this.client.options.baseUrl}/linked-roles/verify-user/callback`)}&response_type=code&scope=identify+role_connections.write&prompt=none`
            }
        });
    }
    /**
     * Handle the verify user callback request
     * @param req The request
     * @returns A response
     */
    async handleUserVerificationCallbackRequest(req) {
        this.assertRegistered();
        const url = new URL(req.url);
        const code = String(url.searchParams.get("code"));
        const tokens = await this.getOAuthTokens(code);
        const authData = await (await fetch("https://discord.com/api/v10/oauth2/@me", {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`
            }
        })).json();
        if (!authData.user)
            return new Response("", {
                status: 307,
                headers: {
                    Location: `${this.client.options.baseUrl}/connect`
                }
            });
        const newMetadata = await this.getMetadataFromCheckers(authData.user.id);
        await this.updateMetadata(authData.user?.id, newMetadata, tokens);
        // IDEA: Maybe we can redirect to a success page instead of just a message
        return new Response("You can now close this tab.");
    }
    async getMetadataFromCheckers(userId) {
        const result = {};
        for (const metadata of this.options.metadata) {
            const checker = this.options.metadataCheckers[metadata.key];
            if (!checker)
                throw new Error(`You did not provide a checker for ${metadata.key}`);
            const value = await checker(userId);
            switch (metadata.type) {
                case ApplicationRoleConnectionMetadataType.BooleanEqual:
                case ApplicationRoleConnectionMetadataType.BooleanNotEqual:
                    if (typeof value !== "boolean")
                        throw new Error(`Expected boolean for ${metadata.key}`);
                    break;
                case ApplicationRoleConnectionMetadataType.DatetimeGreaterThanOrEqual:
                case ApplicationRoleConnectionMetadataType.DatetimeLessThanOrEqual:
                    if (typeof value !== "number")
                        throw new Error(`Expected number for ${metadata.key}`);
                    break;
                case ApplicationRoleConnectionMetadataType.IntegerEqual:
                case ApplicationRoleConnectionMetadataType.IntegerNotEqual:
                case ApplicationRoleConnectionMetadataType.IntegerGreaterThanOrEqual:
                case ApplicationRoleConnectionMetadataType.IntegerLessThanOrEqual:
                    if (!(typeof value === "number" && Number.isSafeInteger(value)))
                        throw new Error(`Expected integer for ${metadata.key}`);
                    break;
                default:
                    throw new Error(`Unknown metadata type ${metadata.type}`);
            }
            result[metadata.key] = value;
        }
        return result;
    }
    async getOAuthTokens(code) {
        this.assertRegistered();
        const url = "https://discord.com/api/v10/oauth2/token";
        const body = new URLSearchParams({
            client_id: this.client.options.clientId,
            client_secret: this.client.options.clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: `${this.client.options.baseUrl}/linked-roles/verify-user/callback`
        });
        const response = await fetch(url, {
            body,
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        throw new Error(`Error fetching OAuth tokens: [${response.status}] ${JSON.stringify(await response.json())}`);
    }
    async updateMetadata(userId, metadata, tokens) {
        this.assertRegistered();
        const url = `https://discord.com/api/v10/users/@me/applications/${this.client.options.clientId}/role-connection`;
        const response = await fetch(url, {
            method: "PUT",
            body: JSON.stringify({ metadata }),
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                "Content-Type": "application/json"
            }
        });
        if (!response.ok) {
            throw new Error(`Error pushing discord metadata for ${userId}: [${response.status}] ${JSON.stringify(await response.json())}`);
        }
    }
    async setMetadata(data) {
        this.assertRegistered();
        const response = await fetch(`https://discord.com/api/v10/applications/${this.client.options.clientId}/role-connections/metadata`, {
            method: "PUT",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bot ${this.client.options.token}`
            }
        });
        if (!response.ok) {
            throw new Error(`Error pushing discord metadata: [${response.status}] ${JSON.stringify(await response.json())}`);
        }
    }
}
//# sourceMappingURL=LinkedRoles.js.map