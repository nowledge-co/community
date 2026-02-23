"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReceiverRoutes = void 0;
const errors_1 = require("../errors");
function buildReceiverRoutes(customRoutes) {
    const routes = {};
    validateCustomRoutes(customRoutes);
    for (const r of customRoutes) {
        const methodObj = Array.isArray(r.method)
            ? // biome-ignore lint/performance/noAccumulatingSpread: TODO: apparently this is a perf hit?
                r.method.reduce((o, key) => ({ ...o, [key.toUpperCase()]: r.handler }), {})
            : { [r.method.toUpperCase()]: r.handler };
        routes[r.path] = routes[r.path] ? { ...routes[r.path], ...methodObj } : methodObj;
    }
    return routes;
}
exports.buildReceiverRoutes = buildReceiverRoutes;
function validateCustomRoutes(customRoutes) {
    const requiredKeys = ['path', 'method', 'handler'];
    const missingKeys = [];
    // Check for missing required keys
    for (const route of customRoutes) {
        for (const key of requiredKeys) {
            if (route[key] === undefined && !missingKeys.includes(key)) {
                missingKeys.push(key);
            }
        }
    }
    if (missingKeys.length > 0) {
        const errorMsg = `One or more routes in customRoutes are missing required keys: ${missingKeys.join(', ')}`;
        throw new errors_1.CustomRouteInitializationError(errorMsg);
    }
}
//# sourceMappingURL=custom-routes.js.map