import { Routes } from "discord-api-types/v10";
import { Client } from "../../classes/Client.js";
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
export class ClientManager {
    /**
     * The routes that the application manager will handle
     */
    routes = [];
    /**
     * The shared deploy secret used for all applications
     */
    deploySecret;
    /**
     * The base URL of the applications to mount the proxy at
     */
    baseUrl;
    /**
     * Shared options that apply to all applications
     * Protected to allow subclasses to use it when creating clients
     */
    sharedOptions;
    clients = new Map();
    staticApplications;
    initialHandlers;
    initialPlugins;
    /**
     * Creates a new ClientManager
     * @param options Configuration options including shared settings and per-app credentials
     */
    constructor(options, handlers, plugins) {
        this.sharedOptions = options.sharedOptions;
        this.deploySecret = options.deploySecret;
        this.baseUrl = options.baseUrl;
        this.staticApplications = options.applications ?? [];
        this.initialHandlers = handlers;
        this.initialPlugins = plugins;
        this.setupRoutes();
        this.getApplications().then(async (applications) => {
            applications.map(async (application) => {
                this.setupClient({
                    clientId: application.clientId,
                    publicKey: application.publicKey,
                    token: application.token
                }, options.initialSetupOptions);
            });
        });
    }
    /**
     * Setup a client from credentials.
     *
     * @param credentials The application credentials
     * @param options The setup options for the client
     * @returns A configured Client instance
     */
    async setupClient(credentials, options = {
        recreate: false,
        setInteractionsUrlOnDevPortal: false,
        setEventsUrlOnDevPortal: false
    }) {
        const existing = this.getClient(credentials.clientId);
        if (existing && !options.recreate) {
            throw new Error(`Client ${credentials.clientId} already exists. If you want to recreate it, pass true to the recreate parameter.`);
        }
        if (existing && options.recreate) {
            this.clients.delete(credentials.clientId);
        }
        if (!this.isValidClientId(credentials.clientId)) {
            throw new Error(`Invalid client ID: ${credentials.clientId}. Client ID must be a valid Discord snowflake (17-19 digits).`);
        }
        const clientOptions = {
            ...this.sharedOptions,
            baseUrl: `${this.baseUrl}/${credentials.clientId}`,
            deploySecret: this.deploySecret,
            clientId: credentials.clientId,
            publicKey: credentials.publicKey,
            token: credentials.token
        };
        const client = new Client(clientOptions, this.initialHandlers, this.initialPlugins);
        this.clients.set(credentials.clientId, client);
        if (options.setInteractionsUrlOnDevPortal ||
            options.setEventsUrlOnDevPortal) {
            await client.rest.patch(Routes.currentApplication(), {
                body: {
                    interactions_endpoint_url: options.setInteractionsUrlOnDevPortal
                        ? `${this.baseUrl}/${credentials.clientId}/interactions`
                        : undefined,
                    event_webhooks_url: options.setEventsUrlOnDevPortal
                        ? `${this.baseUrl}/${credentials.clientId}/events`
                        : undefined
                }
            });
        }
        return client;
    }
    /**
     * Set up the routing for the application manager
     */
    setupRoutes() {
        this.routes.push({
            method: "GET",
            path: "/deploy",
            handler: this.handleGlobalDeploy.bind(this),
            protected: true,
            disabled: !this.deploySecret
        });
        this.routes.push({
            method: "POST",
            path: "/:clientId/*",
            handler: this.handleProxyRequest.bind(this)
        });
        this.routes.push({
            method: "GET",
            path: "/:clientId/*",
            handler: this.handleProxyRequest.bind(this)
        });
    }
    /**
     * Deploy all applications
     */
    async handleGlobalDeploy(req) {
        if (this.deploySecret) {
            const url = new URL(req.url);
            const secret = url.searchParams.get("secret");
            if (secret !== this.deploySecret) {
                await req.text().catch(() => { });
                return new Response("Unauthorized", { status: 401 });
            }
        }
        const results = [];
        const clientIds = this.getClientIds();
        for (const clientId of clientIds) {
            const client = this.getClient(clientId);
            if (!client)
                continue;
            try {
                await client.handleDeployRequest();
                results.push({ clientId, status: "success" });
            }
            catch (error) {
                results.push({
                    clientId,
                    status: `error: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }
        return Response.json(results, { status: 200 });
    }
    /**
     * Handle a request and route it to the appropriate client
     * @param req The incoming request
     * @param ctx Optional context (for Cloudflare Workers, etc.)
     */
    async handleRequest(req, ctx) {
        const url = new URL(req.url);
        const baseUrl = new URL(this.baseUrl);
        const basePathname = baseUrl.pathname.replace(/\/$/, "");
        const reqPathname = url.pathname.replace(/\/$/, "");
        if (!reqPathname.startsWith(basePathname)) {
            await req.text().catch(() => { });
            return new Response("Not Found: Invalid base URL", { status: 404 });
        }
        const truePathname = reqPathname.slice(basePathname.length);
        if (truePathname === "/deploy" && req.method === "GET") {
            return this.handleGlobalDeploy(req);
        }
        const pathParts = truePathname.split("/").filter(Boolean);
        if (pathParts.length < 2) {
            await req.text().catch(() => { });
            return new Response("Bad Request: Invalid path format", { status: 400 });
        }
        const clientId = pathParts[0];
        if (!clientId) {
            await req.text().catch(() => { });
            return new Response("Bad Request: Missing client ID", { status: 400 });
        }
        const client = this.getClient(clientId);
        if (!client) {
            await req.text().catch(() => { });
            return new Response(`Not Found: No application with client ID ${clientId}`, {
                status: 404
            });
        }
        const remainingPath = `/${pathParts.slice(1).join("/")}`;
        const route = client.routes.find((r) => r.path === remainingPath && r.method === req.method && !r.disabled);
        if (!route) {
            await req.text().catch(() => { });
            return new Response(`Not Found: No route ${req.method} ${remainingPath}`, {
                status: 404
            });
        }
        if (route.protected) {
            const secret = url.searchParams.get("secret");
            if (secret !== client.options.deploySecret) {
                await req.text().catch(() => { });
                return new Response("Unauthorized", { status: 401 });
            }
        }
        return route.handler(req, ctx);
    }
    async handleProxyRequest(req, ctx) {
        return this.handleRequest(req, ctx);
    }
    /**
     * Get a client by its client ID
     * @param clientId The client ID to look up
     */
    getClient(clientId) {
        return this.clients.get(clientId);
    }
    /**
     * Get all clients that the manager is managing
     */
    getClients() {
        return Array.from(this.clients.values());
    }
    /**
     * Get all client IDs that the manager is managing
     */
    getClientIds() {
        return Array.from(this.clients.keys());
    }
    /**
     * Get all applications
     * You can override this in an extended class to return dynamic applications
     */
    async getApplications() {
        return this.staticApplications;
    }
    /**
     * Get an application by its client ID
     * You can override this in an extended class to return dynamic applications
     */
    async getApplication(clientId) {
        return this.staticApplications.find((app) => app.clientId === clientId);
    }
    /**
     * Validate if a string is a valid Discord snowflake
     */
    isValidClientId(id) {
        return /^\d{17,19}$/.test(id);
    }
}
//# sourceMappingURL=ClientManager.js.map