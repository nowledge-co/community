import { t as __exportAll } from "./rolldown-runtime-Cbj13DAv.js";
import path from "node:path";
import { AuthStorage, AuthStorage as AuthStorage$1, ModelRegistry, ModelRegistry as ModelRegistry$1 } from "@mariozechner/pi-coding-agent";

//#region src/agents/pi-model-discovery.ts
var pi_model_discovery_exports = /* @__PURE__ */ __exportAll({
	AuthStorage: () => AuthStorage$1,
	ModelRegistry: () => ModelRegistry$1,
	discoverAuthStorage: () => discoverAuthStorage,
	discoverModels: () => discoverModels
});
function createAuthStorage(AuthStorageLike, path) {
	const withFactory = AuthStorageLike;
	if (typeof withFactory.create === "function") return withFactory.create(path);
	return new AuthStorageLike(path);
}
function discoverAuthStorage(agentDir) {
	return createAuthStorage(AuthStorage, path.join(agentDir, "auth.json"));
}
function discoverModels(authStorage, agentDir) {
	return new ModelRegistry(authStorage, path.join(agentDir, "models.json"));
}

//#endregion
export { discoverModels as n, pi_model_discovery_exports as r, discoverAuthStorage as t };