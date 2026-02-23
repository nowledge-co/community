import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
export { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
export declare function discoverAuthStorage(agentDir: string): AuthStorage;
export declare function discoverModels(authStorage: AuthStorage, agentDir: string): ModelRegistry;
