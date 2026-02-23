import type { Context, Route } from "../../abstracts/Plugin.js";
import { Client, type ClientOptions } from "../../classes/Client.js";
/**
 * Credentials for a single application in the ClientManager
 */
export interface ApplicationCredentials {
    /**
     * The client ID of the application - must be a valid Discord snowflake
     */
    clientId: string;
    /**
     * The public key of the app, used for interaction verification
     * Can be a single key or an array of keys
     */
    publicKey: string | string[];
    /**
     * The token of the bot
     */
    token: string;
}
export interface ClientSetupOptions {
    /**
     * Whether to recreate the client if it already exists
     */
    recreate?: boolean;
    /**
     * Whether to set the interactions URL on the Discord Developer Portal
     */
    setInteractionsUrlOnDevPortal?: boolean;
    /**
     * Whether to set the events URL on the Discord Developer Portal
     */
    setEventsUrlOnDevPortal?: boolean;
}
/**
 * Options for the ClientManager
 */
export interface ClientManagerOptions {
    /**
     * The base URL of the applications to mount the proxy at
     */
    baseUrl: string;
    /**
     * The deploy secret of the applications
     */
    deploySecret: string;
    /**
     * Shared options that apply to all applications
     */
    sharedOptions: Omit<ClientOptions, "baseUrl" | "deploySecret" | "clientId" | "publicKey" | "token">;
    /**
     * Array of application credentials.
     * If you need dynamic application loading (e.g., from a database),
     * extend ClientManager and override getClient/getAllClients/getClientIds instead.
     */
    applications?: ApplicationCredentials[];
    /**
     * The initial setup options for the clients, this will be passed to clientManager#setupClient
     */
    initialSetupOptions?: ClientSetupOptions;
}
/**
 * Manages multiple Discord applications, routing requests to the appropriate client
 * based on the client ID in the URL path (/:clientId/*)
 *
 * To use with a database, extend this class and override:
 * - getClient(clientId) - Return the client for a specific ID (or create it)
 * - getAllClients() - Return all available clients
 * - getClientIds() - Return all available client IDs
 *
 * Then call setupClient(credentials) to create clients on-demand.
 */
export declare class ClientManager {
    /**
     * The routes that the application manager will handle
     */
    routes: Route[];
    /**
     * The shared deploy secret used for all applications
     */
    protected deploySecret?: string;
    /**
     * The base URL of the applications to mount the proxy at
     */
    protected baseUrl: string;
    /**
     * Shared options that apply to all applications
     * Protected to allow subclasses to use it when creating clients
     */
    protected sharedOptions: Omit<ClientOptions, "baseUrl" | "deploySecret" | "clientId" | "publicKey" | "token">;
    protected clients: Map<string, Client>;
    protected staticApplications: ApplicationCredentials[];
    protected initialHandlers: ConstructorParameters<typeof Client>[1];
    protected initialPlugins: ConstructorParameters<typeof Client>[2];
    /**
     * Creates a new ClientManager
     * @param options Configuration options including shared settings and per-app credentials
     */
    constructor(options: ClientManagerOptions, handlers: ConstructorParameters<typeof Client>[1], plugins: ConstructorParameters<typeof Client>[2]);
    /**
     * Setup a client from credentials.
     *
     * @param credentials The application credentials
     * @param options The setup options for the client
     * @returns A configured Client instance
     */
    setupClient(credentials: ApplicationCredentials, options?: ClientSetupOptions): Promise<Client>;
    /**
     * Set up the routing for the application manager
     */
    protected setupRoutes(): void;
    /**
     * Deploy all applications
     */
    protected handleGlobalDeploy(req: Request): Promise<Response>;
    /**
     * Handle a request and route it to the appropriate client
     * @param req The incoming request
     * @param ctx Optional context (for Cloudflare Workers, etc.)
     */
    handleRequest(req: Request, ctx?: Context): Promise<Response>;
    protected handleProxyRequest(req: Request, ctx?: Context): Promise<Response>;
    /**
     * Get a client by its client ID
     * @param clientId The client ID to look up
     */
    getClient(clientId: string): Client | undefined;
    /**
     * Get all clients that the manager is managing
     */
    getClients(): Client[];
    /**
     * Get all client IDs that the manager is managing
     */
    getClientIds(): string[];
    /**
     * Get all applications
     * You can override this in an extended class to return dynamic applications
     */
    getApplications(): Promise<ApplicationCredentials[]>;
    /**
     * Get an application by its client ID
     * You can override this in an extended class to return dynamic applications
     */
    getApplication(clientId: string): Promise<ApplicationCredentials | undefined>;
    /**
     * Validate if a string is a valid Discord snowflake
     */
    protected isValidClientId(id: string): boolean;
}
//# sourceMappingURL=ClientManager.d.ts.map