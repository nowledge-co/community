/**
 * Creates a fetch handler function for the client or client manager routes
 * @param client The client or client manager to create the handler for
 * @returns The handler function
 */
export function createHandler(client) {
    return async (req, ctx) => {
        // If it's a ClientManager, delegate to its handleRequest method
        if ("handleRequest" in client) {
            return await client.handleRequest(req, ctx);
        }
        // Otherwise, handle as a regular Client
        const method = req.method;
        const url = new URL(req.url, "http://localhost");
        const pathname = //
         resolveRequestPathname(new URL(client.options.baseUrl), url);
        if (!pathname)
            return new Response("Not Found", { status: 404 });
        const matchedRoutesByPath = //
         client.routes.filter((r) => r.path === pathname && !r.disabled);
        const matchedRoutesByMethod = //
         matchedRoutesByPath.filter((r) => r.method === method);
        if (matchedRoutesByMethod.length === 0) {
            if (matchedRoutesByPath.length > 0)
                return new Response("Method Not Allowed", { status: 405 });
            return new Response("Not Found", { status: 404 });
        }
        // Use the last matched route to allow for overriding
        const route = matchedRoutesByMethod.at(-1);
        const passedSecret = url.searchParams.get("secret");
        if (route.protected && client.options.deploySecret !== passedSecret)
            return new Response("Unauthorized", { status: 401 });
        try {
            return await route.handler(req, ctx);
        }
        catch (error) {
            console.error(error);
            return new Response("Internal Server Error", { status: 500 });
        }
    };
}
function resolveRequestPathname(baseUrl, reqUrl) {
    // Need to use pathname only due to host name being different in Cloudflare Tunnel
    const basePathname = baseUrl.pathname.replace(/\/$/, "");
    const reqPathname = reqUrl.pathname.replace(/\/$/, "");
    if (!reqPathname.startsWith(basePathname))
        return null;
    return reqPathname.slice(basePathname.length);
}
//# sourceMappingURL=index.js.map